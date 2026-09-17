// Licences : patrimoine des droits acquis (US #102, module 3 partie A).
//
// Même convention que contrats.js et commandes.js : enveloppe normalisée
// (server/utils/reponse.js, codes 4000-4099 seedés par la migration 028),
// helper log() vers journal_ecriture avec id_auteur, trace probante auditer()
// vers audit_log sur chaque écriture, contrôle d'existence des références avant
// INSERT, transaction par écriture, relecture de la projection après commit.
//
// Le contrat n'est jamais rattaché directement à la licence : il se déduit de
// la commande (licence.id_commande -> commande.id_contrat), la migration 014
// ayant supprimé licence.id_contrat. La société payeuse suit la même chaîne
// (commande.id_societe), conformément à la doctrine budget.
//
// produit, édition et version vivent en BDD Commune : aucune jointure SQL
// possible, les libellés sont résolus ici après lecture (resoudreCatalogue).
//
// Stories #209 et #210 (migrations 055 et 056) : le type de licence est un
// référentiel (type_licence, sept valeurs) qui porte la règle de chaque date
// (obligatoire, facultative, masquée) et dit si la version est gérée (D58 :
// pas de version sur les souscriptions). Sur les types à version, la version
// courante suit la période de maintenance la plus récente tant que la
// maintenance n'est pas arrêtée (D59) ; chaque changement de version est
// écrit dans licence_version_historique (D60), jamais reconstitué. Le lien de
// succession (id_licence_predecesseur, D35) est saisi sur la licence qui
// renouvelle : une licence qui a un successeur ne déclenche plus d'alerte.
//
// Décisions de la réunion client du 11/09/2026 (migrations 062 et 063) :
// - prolongation (POST /licences/:id/prolonger) : la date de fin de la période
//   en cours est étendue (souscription ou essai par date_fin_souscription,
//   perpétuelle par sa maintenance), opération tracée ; la "nouvelle période"
//   est une création ordinaire préremplie par le front avec
//   id_licence_predecesseur ;
// - le contrat suit les licences (server/utils/successionContrat.js) : chaque
//   licence sert contrat_a_suivre, calculé par la règle pure sur des faits lus
//   ici, jamais écrit en base ;
// - une période de maintenance se rattache à une commande (id_commande) ; le
//   revendeur se lit par la commande, id_revendeur reste en repli ;
// - versions et éditions ajoutables à un produit du catalogue global depuis
//   les formulaires : stockées en Tenant (version_complement,
//   edition_complement, jamais en Commune), résolues avec le catalogue.
//
// Retour client du 16/09/2026 (#201) : « sous maintenance » n'est jamais un
// attribut direct de la licence, seulement un état dérivé de ses périodes
// (maintenance_historique). Les colonnes licence.a_maintenance,
// date_fin_maintenance et id_mainteneur (002) restent en base mais ne sont
// plus ni écrites ni lues : statut_maintenance, mainteneur_label,
// date_debut_maintenance et date_fin_maintenance sont calculés par
// server/utils/maintenanceLicence.js (règle pure testée) depuis les périodes,
// une requête pour toutes les licences lues. Seul l'arrêt (date d'arrêt,
// version figée, D59) reste porté par la licence.
import express from "express";
import { tenantPool, commonPool } from "../db.js";
import { succes, erreur, erreurPivot } from "../utils/reponse.js";
import { auditer, diff } from "../utils/audit.js";
import { permissionsEffectives } from "../utils/droitsUtilisateur.js";
import { LICENCE_EXPIREE } from "../utils/conformite.js";
import { contratDoitSuivre } from "../utils/successionContrat.js";
import { etatMaintenance, echeanceMaintenance } from "../utils/maintenanceLicence.js";

const router = express.Router();

// Convention du projet : helper de journalisation local à chaque routeur.
// id_auteur est lu dans req.user (session JWT) : le routeur est monté après
// authMiddleware, req.user est donc toujours renseigné.
async function log(client, req, action, entite_type, entite_id, description, payload) {
  try {
    await client.query(
      `INSERT INTO journal_ecriture (action, entite_type, entite_id, description, id_auteur, payload)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [action, entite_type, entite_id || null, description, req?.user?.id || null,
       payload ? JSON.stringify(payload) : null]
    );
  } catch (e) {
    console.error("[journal] log failed:", e.message);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Référentiel des types (migration 055) : code, libellé, règle de chaque date
// et gestion de la version. Lu à chaque validation, jamais codé en dur : le
// client peut durcir une règle par une mise à jour de la table.
async function lireTypeLicence(client, code) {
  if (!code || typeof code !== "string") return null;
  const { rows } = await client.query(
    `SELECT code, label, regle_date_debut, regle_date_fin, version_geree, actif
       FROM type_licence WHERE code = $1`, [code]);
  return rows[0] ?? null;
}

// Licence échue : règle partagée de server/utils/conformite.js (LICENCE_EXPIREE,
// forme SQL de TYPES_A_ECHEANCE : souscription et version d'essai, date de fin
// strictement passée), importée et non recopiée depuis l'harmonisation du
// 16/09 (#209) pour que licences, conformité, qualité et tableaux de bord
// expirent les mêmes licences. Une licence sans date de fin n'expire jamais.

// Statut d'échéance : même vocabulaire que contrats et commandes, pour que
// StatutEcheanceBadge serve les trois écrans. Source unique, jamais recalculé
// côté front.
const STATUT_ECHEANCE = `
  CASE
    WHEN l.date_fin_souscription IS NULL                                      THEN 'perpetuel'
    WHEN l.date_fin_souscription < CURRENT_DATE                               THEN 'expire'
    WHEN l.date_fin_souscription <= CURRENT_DATE + INTERVAL '90 days'         THEN 'a_renouveler'
    ELSE 'actif'
  END AS statut_echeance`;

// Le statut de maintenance n'est plus un CASE SQL sur des colonnes de la
// licence (#201) : voir poserMaintenance(), qui lit les périodes et applique
// la règle pure de server/utils/maintenanceLicence.js.

// Balance de conformité par produit : droits = quantités des licences non
// expirées, usage déclaré = affectations de toutes les licences du produit
// (un usage déclaré sur une licence échue reste un usage). Seuils repris de
// l'ancien mock : dépassement au-delà des droits, attention à 90 %.
const SELECT_LICENCE = `
  WITH usage_licence AS (
    SELECT a.id_licence, sum(a.quantite)::int AS quantite
      FROM affectation a
     GROUP BY a.id_licence
  ), balance AS (
    SELECT l.id_produit,
           coalesce(sum(l.quantite) FILTER (WHERE NOT ${LICENCE_EXPIREE}), 0)::int AS droits,
           coalesce(sum(u.quantite), 0)::int AS usage_declare
      FROM licence l
      LEFT JOIN usage_licence u ON u.id_licence = l.id
     GROUP BY l.id_produit
  )
  SELECT l.id, l.label,
         l.id_produit, l.id_edition, l.id_version, l.version_figee_id,
         l.id_commande,     c.label          AS commande_label,
         c.id_contrat,      ct.label         AS contrat_label,
         sct.raison_sociale AS contrat_societe_label,
         ct.date_fin::text  AS contrat_date_fin, ct.a_renouveler AS contrat_a_renouveler, ct.archive AS contrat_archive,
         (SELECT count(*) FROM contrat cx WHERE cx.id_contrat_predecesseur = ct.id)::int AS contrat_nb_successeurs,
         pc.id_contrat      AS id_contrat_predecesseur,
         (SELECT count(*) FROM licence sx JOIN commande sc ON sc.id = sx.id_commande
           WHERE sx.id_licence_predecesseur = l.id AND sc.id_contrat = c.id_contrat)::int AS nb_successeurs_meme_contrat,
         c.id_societe,      s.raison_sociale AS societe_label,
         l.id_revendeur,    r.raison_sociale AS revendeur_label,
         l.id_unite_mesure, um.code AS unite_code, um.label AS unite_label,
         l.quantite, l.type,
         tl.label AS type_label, tl.regle_date_debut, tl.regle_date_fin, tl.version_geree,
         l.cout_licence::float8 AS cout_licence,
         l.date_debut::text             AS date_debut,
         l.date_fin_souscription::text  AS date_fin_souscription,
         l.date_arret_maintenance::text AS date_arret_maintenance,
         l.id_licence_predecesseur, pred.label AS predecesseur_label, pred.id_produit AS predecesseur_id_produit,
         (SELECT count(*) FROM licence sx WHERE sx.id_licence_predecesseur = l.id)::int AS nb_successeurs,
         l.created_at,
         ${STATUT_ECHEANCE},
         CASE WHEN l.date_fin_souscription IS NULL THEN NULL
              ELSE (l.date_fin_souscription - CURRENT_DATE) END AS jours_restants,
         NOT ${LICENCE_EXPIREE} AS droits_actifs,
         coalesce(ul.quantite, 0)::int AS usage_declare,
         b.droits        AS produit_droits,
         b.usage_declare AS produit_usage_declare,
         CASE
           WHEN b.usage_declare > b.droits                           THEN 'depassement'
           WHEN b.droits > 0 AND b.usage_declare >= b.droits * 0.9   THEN 'attention'
           ELSE 'conforme'
         END AS produit_niveau
  FROM licence l
  LEFT JOIN commande     c  ON c.id  = l.id_commande
  LEFT JOIN contrat      ct ON ct.id = c.id_contrat
  LEFT JOIN societe      sct ON sct.id = ct.id_societe
  LEFT JOIN societe      s  ON s.id  = c.id_societe
  LEFT JOIN revendeur    r  ON r.id  = l.id_revendeur
  LEFT JOIN unite_mesure um ON um.id = l.id_unite_mesure
  LEFT JOIN type_licence tl ON tl.code = l.type
  LEFT JOIN licence      pred ON pred.id = l.id_licence_predecesseur
  LEFT JOIN commande     pc ON pc.id = pred.id_commande
  LEFT JOIN usage_licence ul ON ul.id_licence = l.id
  LEFT JOIN balance      b  ON b.id_produit = l.id_produit`;

// Revendeur d'une période : celui de sa commande (062) ; id_revendeur, saisi
// directement avant la 062, reste servi en repli pour les périodes anciennes.
const SELECT_MAINTENANCE = `
  SELECT h.id, h.id_licence,
         h.id_mainteneur, m.raison_sociale AS mainteneur_label,
         h.id_commande,   co.label AS commande_label, co.id_contrat AS commande_id_contrat,
         co.id_revendeur  AS commande_id_revendeur, rc.raison_sociale AS commande_revendeur_label,
         h.id_revendeur,  r.raison_sociale AS revendeur_label,
         h.id_version,
         h.date_debut::text AS date_debut,
         h.date_fin::text   AS date_fin,
         h.cout::float8     AS cout,
         CASE
           WHEN h.date_fin IS NOT NULL AND h.date_fin < CURRENT_DATE THEN 'echue'
           WHEN h.date_debut > CURRENT_DATE                          THEN 'a_venir'
           ELSE 'en_cours'
         END AS statut,
         h.created_at
    FROM maintenance_historique h
    LEFT JOIN mainteneur m  ON m.id  = h.id_mainteneur
    LEFT JOIN commande   co ON co.id = h.id_commande
    LEFT JOIN revendeur  rc ON rc.id = co.id_revendeur
    LEFT JOIN revendeur  r  ON r.id  = h.id_revendeur`;

// a_maintenance, id_mainteneur et date_fin_maintenance n'en font plus partie
// (#201) : la maintenance se saisit par ses périodes, jamais sur la licence.
const CHAMPS = [
  "label", "id_produit", "id_edition", "id_version", "id_commande", "id_revendeur",
  "id_unite_mesure", "quantite", "type", "cout_licence", "date_debut", "date_fin_souscription",
  "id_licence_predecesseur",
];

// Historique des versions (D60) : libellés des versions résolus depuis la
// BDD Commune, une requête pour toutes les lignes.
const SELECT_VERSIONS = `
  SELECT v.id, v.id_licence, v.id_version_avant, v.id_version_apres, v.evenement,
         v.id_maintenance, v.date_effet::text AS date_effet, v.id_auteur,
         u.prenom AS auteur_prenom, u.nom AS auteur_nom,
         v.created_at
    FROM licence_version_historique v
    LEFT JOIN utilisateur u ON u.id = v.id_auteur`;

async function resoudreVersions(rows, cles) {
  if (!rows.length) return rows;
  const ids = [...new Set(rows.flatMap((r) => cles.map((k) => r[k])).filter(Boolean))];
  const labels = new Map();
  if (ids.length) {
    const { rows: v } = await commonPool.query(`SELECT id, label FROM version WHERE id = ANY($1)`, [ids]);
    for (const x of v) labels.set(x.id, x.label);
    // Versions ajoutées par le client (063), hors catalogue Commune.
    const restants = ids.filter((id) => !labels.has(id));
    if (restants.length) {
      const { rows: c } = await tenantPool.query(`SELECT id, label FROM version_complement WHERE id = ANY($1)`, [restants]);
      for (const x of c) labels.set(x.id, x.label);
    }
  }
  return rows.map((r) => {
    const out = { ...r };
    for (const k of cles) out[`${k.replace(/^id_/, "")}_label`] = r[k] ? labels.get(r[k]) ?? null : null;
    return out;
  });
}

// Une ligne d'historique par changement effectif de version, dans la
// transaction du changement. Aucune ligne si la version ne bouge pas.
async function journaliserVersion(client, req, { idLicence, avant, apres, evenement, idMaintenance = null, dateEffet = null, force = false }) {
  if (!force && (avant ?? null) === (apres ?? null)) return;
  await client.query(
    `INSERT INTO licence_version_historique
       (id_licence, id_version_avant, id_version_apres, evenement, id_maintenance, date_effet, id_auteur)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7)`,
    [idLicence, avant ?? null, apres ?? null, evenement, idMaintenance, dateEffet, req?.user?.id || null]);
}

// ---------------------------------------------------------------------------
// Résolution du catalogue (BDD Commune) et masquage des montants
// ---------------------------------------------------------------------------

// Pose produit_label, produit_sku, id_editeur, editeur_label, edition_label,
// version_label et version_figee_label sur chaque ligne. Une seule requête
// Commune pour les produits, une pour éditions et versions, une Tenant pour
// les éditeurs : jamais une requête par ligne.
async function resoudreCatalogue(rows) {
  if (!rows.length) return rows;
  const idsProduits = [...new Set(rows.map((r) => r.id_produit).filter(Boolean))];
  const idsDeclinaisons = [...new Set(rows.flatMap((r) =>
    [r.id_edition, r.id_version, r.version_figee_id]).filter(Boolean))];

  const produits = new Map();
  if (idsProduits.length) {
    const { rows: p } = await commonPool.query(
      `SELECT id, label, sku, id_editeur FROM produit_referentiel WHERE id = ANY($1)`, [idsProduits]);
    for (const x of p) produits.set(x.id, x);
  }
  const declinaisons = new Map();
  if (idsDeclinaisons.length) {
    const { rows: d } = await commonPool.query(
      `SELECT id, label FROM edition WHERE id = ANY($1)
       UNION ALL
       SELECT id, label FROM version WHERE id = ANY($1)`, [idsDeclinaisons]);
    for (const x of d) declinaisons.set(x.id, x.label);
    // Déclinaisons ajoutées par le client (063) : mêmes identifiants
    // logiques, stockées en Tenant. Une requête pour tout ce qui manque.
    const restants = idsDeclinaisons.filter((id) => !declinaisons.has(id));
    if (restants.length) {
      const { rows: c } = await tenantPool.query(
        `SELECT id, label FROM edition_complement WHERE id = ANY($1)
         UNION ALL
         SELECT id, label FROM version_complement WHERE id = ANY($1)`, [restants]);
      for (const x of c) declinaisons.set(x.id, x.label);
    }
  }
  const idsEditeurs = [...new Set([...produits.values()].map((p) => p.id_editeur).filter(Boolean))];
  const editeurs = new Map();
  if (idsEditeurs.length) {
    const { rows: e } = await tenantPool.query(
      `SELECT id, raison_sociale FROM editeur WHERE id = ANY($1)`, [idsEditeurs]);
    for (const x of e) editeurs.set(x.id, x.raison_sociale);
  }

  return rows.map((r) => {
    const p = produits.get(r.id_produit);
    return {
      ...r,
      produit_label: p?.label ?? null,
      produit_sku: p?.sku ?? null,
      id_editeur: p?.id_editeur ?? null,
      editeur_label: p?.id_editeur ? editeurs.get(p.id_editeur) ?? null : null,
      edition_label: r.id_edition ? declinaisons.get(r.id_edition) ?? null : null,
      version_label: r.id_version ? declinaisons.get(r.id_version) ?? null : null,
      version_figee_label: r.version_figee_id ? declinaisons.get(r.version_figee_id) ?? null : null,
    };
  });
}

// Montants visibles avec consulter_kpi_financiers seulement : Admin, Manager
// DSI et Financier la détiennent, IT Ops non. Même calcul que le middleware
// (droitsUtilisateur.js) : le front applique la même règle par hasPermission.
// Les montants masqués sortent à null avec montants_masques = true, jamais
// caviardés en chaîne : un consommateur ne doit pas confondre "masque" et "0".
async function montantsVisibles(req) {
  const { permissions } = await permissionsEffectives(req.user.id);
  return permissions.has("consulter_kpi_financiers");
}

function masquerLicence(row, visibles) {
  return visibles ? { ...row, montants_masques: false }
                  : { ...row, cout_licence: null, montants_masques: true };
}

function masquerMaintenance(row, visibles) {
  return visibles ? { ...row, montants_masques: false }
                  : { ...row, cout: null, montants_masques: true };
}

// Le contrat suit les licences (décision du 11/09/2026) : contrat_a_suivre
// est vrai si la licence a été renouvelée sur son contrat (elle renouvelle
// une licence du même contrat, ou une licence du même contrat la renouvelle)
// et que ce contrat est échu ou à échéance sans successeur. Règle pure,
// appliquée sur les faits de la projection, jamais stockée.
function poserContratASuivre(rows) {
  return rows.map((r) => ({
    ...r,
    contrat_a_suivre: contratDoitSuivre(r, {
      date_fin: r.contrat_date_fin, a_renouveler: r.contrat_a_renouveler,
      nb_successeurs: r.contrat_nb_successeurs, archive: r.contrat_archive,
    }),
  }));
}

// État de maintenance dérivé des périodes (#201) : une requête pour toutes
// les licences lues, puis la règle pure. Pose statut_maintenance,
// id_maintenance_reference, id_mainteneur, mainteneur_label,
// date_debut_maintenance, date_fin_maintenance et nb_periodes_maintenance sur
// chaque ligne ; les écrans qui lisaient ces clés depuis les colonnes de la
// licence les trouvent inchangées.
async function poserMaintenance(rows) {
  if (!rows.length) return rows;
  const { rows: periodes } = await tenantPool.query(
    `SELECT h.id, h.id_licence, h.id_mainteneur, m.raison_sociale AS mainteneur_label,
            h.date_debut::text AS date_debut, h.date_fin::text AS date_fin, h.created_at
       FROM maintenance_historique h
       LEFT JOIN mainteneur m ON m.id = h.id_mainteneur
      WHERE h.id_licence = ANY($1)
      ORDER BY h.date_debut, h.created_at`,
    [rows.map((r) => r.id)]);
  const parLicence = new Map();
  for (const p of periodes) {
    if (!parLicence.has(p.id_licence)) parLicence.set(p.id_licence, []);
    parLicence.get(p.id_licence).push(p);
  }
  return rows.map((r) => ({ ...r, ...etatMaintenance(r, parLicence.get(r.id) ?? []) }));
}

async function lireLicence(id, req) {
  const { rows } = await tenantPool.query(`${SELECT_LICENCE} WHERE l.id = $1`, [id]);
  if (!rows.length) return null;
  const [resolue] = await resoudreCatalogue(await poserMaintenance(poserContratASuivre(rows)));
  return masquerLicence(resolue, await montantsVisibles(req));
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

async function existe(client, table, id) {
  if (!id) return true;
  const { rowCount } = await client.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
  return rowCount > 0;
}

// Référence vers la BDD Commune : produit, ou déclinaison rattachée au produit.
async function produitExiste(id) {
  const { rowCount } = await commonPool.query(`SELECT 1 FROM produit_referentiel WHERE id = $1`, [id]);
  return rowCount > 0;
}
// La déclinaison peut venir du catalogue Commune ou des compléments ajoutés
// par le client (063, table <table>_complement en Tenant) : les deux sources
// sont acceptées, toujours rattachées au produit.
async function declinaisonDuProduit(table, id, idProduit) {
  if (!id) return true;
  const { rowCount } = await commonPool.query(
    `SELECT 1 FROM ${table} WHERE id = $1 AND id_produit = $2`, [id, idProduit]);
  if (rowCount > 0) return true;
  const { rowCount: complement } = await tenantPool.query(
    `SELECT 1 FROM ${table}_complement WHERE id = $1 AND id_produit = $2`, [id, idProduit]);
  return complement > 0;
}

// Un <select> vide et un <input type="date"> vide envoient "" et non null.
function normaliserCorps(body = {}) {
  const vide = (v) => (v === "" || v === undefined ? null : v);
  const nombre = (v) => (vide(v) === null ? null : Number(v));
  const label = vide(body.label);
  return {
    label: label === null ? null : String(label).trim() || null,
    id_produit: vide(body.id_produit),
    id_edition: vide(body.id_edition),
    id_version: vide(body.id_version),
    id_commande: vide(body.id_commande),
    id_revendeur: vide(body.id_revendeur),
    id_unite_mesure: vide(body.id_unite_mesure),
    quantite: nombre(body.quantite),
    type: vide(body.type),
    cout_licence: nombre(body.cout_licence),
    date_debut: vide(body.date_debut),
    date_fin_souscription: vide(body.date_fin_souscription),
    id_licence_predecesseur: vide(body.id_licence_predecesseur),
  };
}

// Les UUID sont contrôlés avant toute requête : un UUID malformé part sinon en
// Postgres et ressort en 22P02 illisible là où la référence est simplement
// introuvable.
const uuidValide = (v) => !v || UUID_RE.test(v);

// Le type est validé en premier : sa règle (dates, version) pilote le reste.
// typeInitial : type déjà porté par la licence (PATCH), accepté même si la
// valeur n'est plus proposée à la saisie (type_licence.actif = false).
async function validerLicence(client, corps, { typeInitial = null, idLicence = null } = {}) {
  const c = corps;
  const regle = await lireTypeLicence(client, c.type);
  if (!regle || (!regle.actif && c.type !== typeInitial))
    return { status: 400, code: 4018, error: "Type de licence inconnu." };
  coherer(c, regle);
  if (!c.id_produit)
    return { status: 400, code: 4011, error: "Le logiciel est obligatoire." };
  if (!uuidValide(c.id_produit) || !(await produitExiste(c.id_produit)))
    return { status: 400, code: 4012, error: "Logiciel introuvable au catalogue." };
  if (!uuidValide(c.id_edition) || !(await declinaisonDuProduit("edition", c.id_edition, c.id_produit)))
    return { status: 400, code: 4013, error: "Édition introuvable ou étrangère au logiciel." };
  if (!uuidValide(c.id_version) || !(await declinaisonDuProduit("version", c.id_version, c.id_produit)))
    return { status: 400, code: 4014, error: "Version introuvable ou étrangère au logiciel." };
  if (!uuidValide(c.id_commande) || !(await existe(client, "commande", c.id_commande)))
    return { status: 400, code: 4015, error: "Commande introuvable." };
  if (!uuidValide(c.id_revendeur) || !(await existe(client, "revendeur", c.id_revendeur)))
    return { status: 400, code: 4016, error: "Revendeur introuvable." };
  if (!uuidValide(c.id_unite_mesure) || !(await existe(client, "unite_mesure", c.id_unite_mesure)))
    return { status: 400, code: 4017, error: "Unite de mesure introuvable." };
  // Zéro accepté : c'est la borne du CHECK licence_quantite_check, et une
  // licence à zéro droit reste un fait (lot épuisé, retiré). Le front impose 1.
  if (!Number.isInteger(c.quantite) || c.quantite < 0)
    return { status: 400, code: 4019, error: "La quantite doit etre un entier positif ou nul." };
  if (c.cout_licence !== null && (!Number.isFinite(c.cout_licence) || c.cout_licence < 0))
    return { status: 400, code: 4020, error: "Le cout doit etre un montant positif ou nul." };
  // Règles de dates du type (#209). Les dates masquées ont été effacées par
  // coherer() ; restent les obligations et les formats.
  if (regle.regle_date_debut === "obligatoire" && !c.date_debut)
    return { status: 400, code: 4031, error: `La date de debut est obligatoire pour une licence de type ${regle.label}.` };
  if (regle.regle_date_fin === "obligatoire" && !c.date_fin_souscription)
    return { status: 400, code: 4021, error: `La date de fin est obligatoire pour une licence de type ${regle.label}.` };
  if (c.date_debut && !DATE_RE.test(c.date_debut))
    return { status: 400, code: 4024, error: "La date de debut est invalide." };
  if (c.date_fin_souscription && !DATE_RE.test(c.date_fin_souscription))
    return { status: 400, code: 4024, error: "La date de fin est invalide." };
  // Doublon volontaire de ck_licence_dates (055) : la contrainte produirait
  // une 23514 en 500, on veut un 400 lisible.
  if (c.date_debut && c.date_fin_souscription && c.date_fin_souscription < c.date_debut)
    return { status: 400, code: 4032, error: "La date de fin doit etre posterieure a la date de debut." };
  // Succession (D35) : la licence renouvelée doit exister et n'être ni la
  // licence elle-même ni l'un de ses propres successeurs (pas de boucle).
  if (c.id_licence_predecesseur) {
    if (!uuidValide(c.id_licence_predecesseur) || !(await existe(client, "licence", c.id_licence_predecesseur)))
      return { status: 400, code: 4010, error: "Licence renouvelee introuvable." };
    if (idLicence && (c.id_licence_predecesseur === idLicence || await estSuccesseurDe(client, c.id_licence_predecesseur, idLicence)))
      return { status: 409, code: 4010, error: "Une licence ne peut pas renouveler l'une de ses propres successions." };
  }
  return null;
}

// Vrai si candidat descend (par id_licence_predecesseur) de origine.
async function estSuccesseurDe(client, candidat, origine) {
  const { rowCount } = await client.query(
    `WITH RECURSIVE chaine AS (
       SELECT id, id_licence_predecesseur FROM licence WHERE id = $1
       UNION
       SELECT l.id, l.id_licence_predecesseur FROM licence l JOIN chaine c ON l.id = c.id_licence_predecesseur
     )
     SELECT 1 FROM chaine WHERE id_licence_predecesseur = $2 LIMIT 1`, [candidat, origine]);
  return rowCount > 0;
}

// Applique la règle du type : une date masquée est effacée plutôt que
// refusée (un changement de type ne doit pas obliger à vider le champ à la
// main) ; un type sans version (D58, souscription) ne porte pas de version.
function coherer(corps, regle) {
  if (!regle) return corps;
  if (regle.regle_date_debut === "masquee") corps.date_debut = null;
  if (regle.regle_date_fin === "masquee") corps.date_fin_souscription = null;
  if (!regle.version_geree) corps.id_version = null;
  return corps;
}

function normaliserMaintenance(body = {}) {
  const vide = (v) => (v === "" || v === undefined ? null : v);
  const cout = vide(body.cout);
  return {
    id_mainteneur: vide(body.id_mainteneur),
    id_commande: vide(body.id_commande),
    id_revendeur: vide(body.id_revendeur),
    date_debut: vide(body.date_debut),
    date_fin: vide(body.date_fin),
    cout: cout === null ? null : Number(cout),
    id_version: vide(body.id_version),
  };
}

// licence : ligne brute de la licence porteuse (la version d'une période doit
// appartenir à son produit, même contrôle que sur la licence).
async function validerMaintenance(client, m, licence) {
  if (!m.date_debut)
    return { status: 400, code: 4031, error: "La date de debut est obligatoire." };
  if (!DATE_RE.test(m.date_debut) || (m.date_fin && !DATE_RE.test(m.date_fin)))
    return { status: 400, code: 4024, error: "Date invalide." };
  // Doublon volontaire de ck_maintenance_dates : la contrainte produirait une
  // 23514 en 500, on veut un 400 lisible.
  if (m.date_fin && m.date_fin < m.date_debut)
    return { status: 400, code: 4032, error: "La date de fin doit etre posterieure a la date de debut." };
  if (m.cout !== null && (!Number.isFinite(m.cout) || m.cout < 0))
    return { status: 400, code: 4033, error: "Le cout de maintenance doit etre un montant positif ou nul." };
  if (!uuidValide(m.id_mainteneur) || !(await existe(client, "mainteneur", m.id_mainteneur)))
    return { status: 400, code: 4022, error: "Mainteneur introuvable." };
  // Commande de la période (062) : n'importe quelle commande existante, le
  // front propose celles du contrat de la licence en premier sans l'imposer.
  if (!uuidValide(m.id_commande) || !(await existe(client, "commande", m.id_commande)))
    return { status: 400, code: 4015, error: "Commande introuvable." };
  if (!uuidValide(m.id_revendeur) || !(await existe(client, "revendeur", m.id_revendeur)))
    return { status: 400, code: 4016, error: "Revendeur introuvable." };
  if (m.id_version && (!uuidValide(m.id_version) || !licence?.id_produit
      || !(await declinaisonDuProduit("version", m.id_version, licence.id_produit))))
    return { status: 400, code: 4014, error: "Version introuvable ou étrangère au logiciel." };
  return null;
}

// id_revendeur conservé pour les périodes antérieures à la 062 (un PATCH
// partiel ne l'efface pas) ; le formulaire ne l'envoie plus.
const CHAMPS_MAINTENANCE = ["id_mainteneur", "id_commande", "id_revendeur", "date_debut", "date_fin", "cout", "id_version"];

// État de la licence tel qu'il est audité : les colonnes brutes, pas la
// projection (les libellés résolus ne sont pas des données de la licence).
// Les colonnes a_maintenance, id_mainteneur et date_fin_maintenance ne sont
// plus lues (#201) : elles ne figurent donc plus dans l'état audité.
const COLONNES_BRUTES = `label, id_produit, id_edition, id_version, id_commande, id_revendeur,
    id_unite_mesure, quantite, type, cout_licence::float8 AS cout_licence,
    date_debut::text AS date_debut,
    date_fin_souscription::text AS date_fin_souscription,
    version_figee_id, date_arret_maintenance::text AS date_arret_maintenance,
    id_licence_predecesseur`;

async function lireBrute(client, id, verrou = false) {
  const { rows } = await client.query(
    `SELECT ${COLONNES_BRUTES} FROM licence WHERE id = $1${verrou ? " FOR UPDATE" : ""}`, [id]);
  return rows[0] ?? null;
}

const introuvable = (res) => erreur(res, 4010, { status: 404, message: "Licence introuvable." });

// ---------------------------------------------------------------------------
// Licences
// ---------------------------------------------------------------------------

// Filtres optionnels : id_produit, id_commande, id_revendeur, id_contrat (via
// la commande), type. Le front filtre le reste localement.
router.get("/licences", async (req, res) => {
  try {
    const { id_produit, id_commande, id_revendeur, id_contrat, type } = req.query;
    for (const v of [id_produit, id_commande, id_revendeur, id_contrat]) {
      if (v && !UUID_RE.test(v))
        return erreur(res, 4010, { status: 400, message: "Identifiant de filtre invalide." });
    }
    if (type && !(await lireTypeLicence(tenantPool, type)))
      return erreur(res, 4018, { status: 400, message: "Type de licence inconnu." });

    const { rows } = await tenantPool.query(
      `${SELECT_LICENCE}
        WHERE ($1::uuid IS NULL OR l.id_produit   = $1::uuid)
          AND ($2::uuid IS NULL OR l.id_commande  = $2::uuid)
          AND ($3::uuid IS NULL OR l.id_revendeur = $3::uuid)
          AND ($4::uuid IS NULL OR c.id_contrat   = $4::uuid)
          AND ($5::text IS NULL OR l.type         = $5::text)
        ORDER BY l.created_at DESC, l.label`,
      [id_produit || null, id_commande || null, id_revendeur || null, id_contrat || null, type || null]);

    const visibles = await montantsVisibles(req);
    const resolues = await resoudreCatalogue(await poserMaintenance(poserContratASuivre(rows)));
    succes(res, 4000, resolues.map((r) => masquerLicence(r, visibles)));
  } catch (err) {
    console.error("GET /licences error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  }
});

router.get("/licences/:id", async (req, res) => {
  const { id } = req.params;
  try {
    if (!UUID_RE.test(id)) return introuvable(res);
    const licence = await lireLicence(id, req);
    if (!licence) return introuvable(res);

    // Compteurs de rattachements, les mêmes que le garde-fou de suppression.
    const { rows: [liens] } = await tenantPool.query(
      `SELECT (SELECT count(*) FROM affectation             WHERE id_licence = $1)::int AS nb_affectations,
              (SELECT count(*) FROM budget                  WHERE id_licence = $1)::int AS nb_budgets,
              (SELECT count(*) FROM maintenance_historique  WHERE id_licence = $1)::int AS nb_maintenances`,
      [id]);
    // Historique des versions (D60), du plus récent au plus ancien.
    const { rows: versions } = await tenantPool.query(
      `${SELECT_VERSIONS} WHERE v.id_licence = $1 ORDER BY v.created_at DESC`, [id]);
    const historique_versions = await resoudreVersions(versions, ["id_version_avant", "id_version_apres"]);
    succes(res, 4001, { ...licence, ...liens, historique_versions });
  } catch (err) {
    console.error("GET /licences/:id error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  }
});

router.post("/licences", async (req, res) => {
  const corps = normaliserCorps(req.body);
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    const invalide = await validerLicence(client, corps);
    if (invalide) {
      await client.query("ROLLBACK");
      return erreurPivot(res, invalide);
    }

    const { rows: [creee] } = await client.query(
      `INSERT INTO licence (${CHAMPS.join(", ")})
       VALUES (${CHAMPS.map((_, i) => `$${i + 1}`).join(", ")})
       RETURNING id`,
      CHAMPS.map((ch) => corps[ch]));
    // Une version saisie à la création ouvre l'historique (avant = aucune).
    await journaliserVersion(client, req, { idLicence: creee.id, avant: null, apres: corps.id_version, evenement: "modification" });

    const apres = await lireBrute(client, creee.id);
    await auditer(client, req, { action: "LICENCE_CREEE", entiteType: "licence", entiteId: creee.id, apres });
    await log(client, req, "CREATE", "licence", creee.id,
      `Creation de la licence "${corps.label ?? creee.id}"`, corps);
    await client.query("COMMIT");

    succes(res, 4002, await lireLicence(creee.id, req), { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /licences error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.patch("/licences/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    if (!UUID_RE.test(id)) { await client.query("ROLLBACK"); return introuvable(res); }
    const avant = await lireBrute(client, id, true);
    if (!avant) { await client.query("ROLLBACK"); return introuvable(res); }

    // Fusion avant validation : un PATCH partiel ne doit pas échouer sur un
    // champ obligatoire qui n'a simplement pas été transmis.
    const patch = normaliserCorps(req.body);
    const corps = {};
    for (const champ of CHAMPS) {
      corps[champ] = Object.prototype.hasOwnProperty.call(req.body, champ) ? patch[champ] : avant[champ];
    }

    const invalide = await validerLicence(client, corps, { typeInitial: avant.type, idLicence: id });
    if (invalide) { await client.query("ROLLBACK"); return erreurPivot(res, invalide); }

    // Changer de produit invalide une version figée qui lui était propre.
    const versionFigee = corps.id_produit === avant.id_produit ? avant.version_figee_id : null;

    await client.query(
      `UPDATE licence
          SET ${CHAMPS.map((ch, i) => `${ch} = $${i + 1}`).join(", ")},
              version_figee_id = $${CHAMPS.length + 1}
        WHERE id = $${CHAMPS.length + 2}`,
      [...CHAMPS.map((ch) => corps[ch]), versionFigee, id]);
    // Saisie directe d'une version (ou effacement par un type sans version).
    await journaliserVersion(client, req, { idLicence: id, avant: avant.id_version, apres: corps.id_version, evenement: "modification" });

    const apres = await lireBrute(client, id);
    const d = diff(avant, apres);
    await auditer(client, req, { action: "LICENCE_MODIFIEE", entiteType: "licence", entiteId: id, avant: d.avant, apres: d.apres });
    await log(client, req, "UPDATE", "licence", id,
      `Modification de la licence "${corps.label ?? id}"`, patch);
    await client.query("COMMIT");

    succes(res, 4003, await lireLicence(id, req));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /licences/:id error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.delete("/licences/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    if (!UUID_RE.test(id)) { await client.query("ROLLBACK"); return introuvable(res); }
    const avant = await lireBrute(client, id, true);
    if (!avant) { await client.query("ROLLBACK"); return introuvable(res); }

    // FK entrantes sans cascade du DDL v4 : affectation et budget. L'historique
    // de maintenance tombé avec la licence (ON DELETE CASCADE), il n'est pas
    // bloquant.
    // Une licence renouvelée par un successeur (id_licence_predecesseur, 056,
    // sans cascade) est également protégée : le lien de succession se retire
    // d'abord sur le successeur.
    // Une preuve rattachée à la licence (preuve.id_licence, 053, FK RESTRICT
    // volontaire : une pièce d'audit ne se détache pas en silence) bloque de
    // même, en 4023 lisible plutôt qu'en 23503 brute remontée en 4099.
    const { rows: [liens] } = await client.query(
      `SELECT (SELECT count(*) FROM affectation WHERE id_licence = $1) AS affectations,
              (SELECT count(*) FROM budget      WHERE id_licence = $1) AS budgets,
              (SELECT count(*) FROM licence     WHERE id_licence_predecesseur = $1) AS successeurs,
              (SELECT count(*) FROM preuve      WHERE id_licence = $1) AS preuves`,
      [id]);
    const bloquants = [];
    if (+liens.affectations) bloquants.push(`${liens.affectations} affectation(s)`);
    if (+liens.budgets)      bloquants.push(`${liens.budgets} ligne(s) budgetaire(s)`);
    if (+liens.successeurs)  bloquants.push(`${liens.successeurs} licence(s) qui la renouvelle(nt)`);
    if (+liens.preuves)      bloquants.push(`${liens.preuves} preuve(s)`);
    if (bloquants.length) {
      await client.query("ROLLBACK");
      return erreur(res, 4023, {
        status: 409,
        message: `Suppression impossible : cette licence porte ${bloquants.join(", ")}.`,
        details: liens,
      });
    }

    await client.query(`DELETE FROM licence WHERE id = $1`, [id]);
    await auditer(client, req, { action: "LICENCE_SUPPRIMEE", entiteType: "licence", entiteId: id, avant });
    await log(client, req, "DELETE", "licence", id,
      `Suppression de la licence "${avant.label ?? id}"`, null);
    await client.query("COMMIT");
    succes(res, 4004, null);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /licences/:id error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// Historique de maintenance
// ---------------------------------------------------------------------------

router.get("/licences/:id/maintenance", async (req, res) => {
  const { id } = req.params;
  try {
    if (!UUID_RE.test(id)) return introuvable(res);
    const { rowCount } = await tenantPool.query(`SELECT 1 FROM licence WHERE id = $1`, [id]);
    if (!rowCount) return introuvable(res);

    const { rows } = await tenantPool.query(
      `${SELECT_MAINTENANCE} WHERE h.id_licence = $1 ORDER BY h.date_debut DESC, h.created_at DESC`, [id]);
    const visibles = await montantsVisibles(req);
    const resolues = await resoudreVersions(rows, ["id_version"]);
    succes(res, 4005, resolues.map((r) => masquerMaintenance(r, visibles)));
  } catch (err) {
    console.error("GET /licences/:id/maintenance error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  }
});

// Ajouter, modifier ou retirer une période ne pose plus rien sur la licence
// au titre de la maintenance (#201) : son état se lit sur les périodes.
// Version portée par la maintenance (D59) : sur un type à version et tant que
// la maintenance n'est pas arrêtée, la version courante de la licence suit la
// période la plus récente qui en porte une. Une licence arrêtée garde sa
// version figée ; une période sans version ne change rien.
async function repercuterSurLicence(client, req, idLicence) {
  const { rows: [l] } = await client.query(
    `SELECT l.id_version, l.date_arret_maintenance, COALESCE(tl.version_geree, true) AS version_geree
       FROM licence l LEFT JOIN type_licence tl ON tl.code = l.type WHERE l.id = $1`, [idLicence]);
  if (!l || l.date_arret_maintenance || !l.version_geree) return;
  const { rows: [periode] } = await client.query(
    `SELECT id, id_version, date_debut::text AS date_debut
       FROM maintenance_historique
      WHERE id_licence = $1 AND id_version IS NOT NULL
      ORDER BY date_debut DESC, created_at DESC LIMIT 1`, [idLicence]);
  if (!periode || periode.id_version === l.id_version) return;
  await client.query(`UPDATE licence SET id_version = $1 WHERE id = $2`, [periode.id_version, idLicence]);
  await journaliserVersion(client, req, {
    idLicence, avant: l.id_version, apres: periode.id_version, evenement: "maintenance",
    idMaintenance: periode.id, dateEffet: periode.date_debut,
  });
}

router.post("/licences/:id/maintenance", async (req, res) => {
  const { id } = req.params;
  const m = normaliserMaintenance(req.body);
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    if (!UUID_RE.test(id)) { await client.query("ROLLBACK"); return introuvable(res); }
    const licence = await lireBrute(client, id, true);
    if (!licence) { await client.query("ROLLBACK"); return introuvable(res); }

    const invalide = await validerMaintenance(client, m, licence);
    if (invalide) { await client.query("ROLLBACK"); return erreurPivot(res, invalide); }

    const { rows: [creee] } = await client.query(
      `INSERT INTO maintenance_historique (id_licence, ${CHAMPS_MAINTENANCE.join(", ")})
       VALUES ($1, ${CHAMPS_MAINTENANCE.map((_, i) => `$${i + 2}`).join(", ")}) RETURNING id`,
      [id, ...CHAMPS_MAINTENANCE.map((ch) => m[ch])]);
    await repercuterSurLicence(client, req, id);

    await auditer(client, req, { action: "MAINTENANCE_AJOUTEE", entiteType: "maintenance_historique", entiteId: creee.id, apres: { id_licence: id, ...m } });
    await log(client, req, "CREATE", "maintenance_historique", creee.id,
      `Periode de maintenance ajoutee sur la licence ${id}`, m);
    await client.query("COMMIT");

    const { rows } = await tenantPool.query(`${SELECT_MAINTENANCE} WHERE h.id = $1`, [creee.id]);
    const [periode] = await resoudreVersions(rows, ["id_version"]);
    succes(res, 4006, masquerMaintenance(periode, await montantsVisibles(req)), { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /licences/:id/maintenance error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

const periodeIntrouvable = (res) => erreur(res, 4030, { status: 404, message: "Periode de maintenance introuvable." });

router.patch("/licences/:id/maintenance/:mid", async (req, res) => {
  const { id, mid } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    if (!UUID_RE.test(id)) { await client.query("ROLLBACK"); return introuvable(res); }
    if (!UUID_RE.test(mid)) { await client.query("ROLLBACK"); return periodeIntrouvable(res); }
    const licence = await lireBrute(client, id, true);
    if (!licence) { await client.query("ROLLBACK"); return introuvable(res); }

    const { rows: existant } = await client.query(
      `SELECT id_mainteneur, id_commande, id_revendeur, date_debut::text AS date_debut, date_fin::text AS date_fin,
              cout::float8 AS cout, id_version
         FROM maintenance_historique WHERE id = $1 AND id_licence = $2 FOR UPDATE`, [mid, id]);
    if (!existant.length) { await client.query("ROLLBACK"); return periodeIntrouvable(res); }

    const patch = normaliserMaintenance(req.body);
    const m = { ...existant[0] };
    for (const ch of CHAMPS_MAINTENANCE) {
      if (Object.prototype.hasOwnProperty.call(req.body, ch)) m[ch] = patch[ch];
    }
    const invalide = await validerMaintenance(client, m, licence);
    if (invalide) { await client.query("ROLLBACK"); return erreurPivot(res, invalide); }

    await client.query(
      `UPDATE maintenance_historique
          SET ${CHAMPS_MAINTENANCE.map((ch, i) => `${ch} = $${i + 1}`).join(", ")}
        WHERE id = $${CHAMPS_MAINTENANCE.length + 1}`,
      [...CHAMPS_MAINTENANCE.map((ch) => m[ch]), mid]);
    await repercuterSurLicence(client, req, id);

    const d = diff(existant[0], m);
    await auditer(client, req, { action: "MAINTENANCE_MODIFIEE", entiteType: "maintenance_historique", entiteId: mid, avant: d.avant, apres: d.apres });
    await log(client, req, "UPDATE", "maintenance_historique", mid,
      `Periode de maintenance modifiee sur la licence ${id}`, patch);
    await client.query("COMMIT");

    const { rows } = await tenantPool.query(`${SELECT_MAINTENANCE} WHERE h.id = $1`, [mid]);
    const [periode] = await resoudreVersions(rows, ["id_version"]);
    succes(res, 4007, masquerMaintenance(periode, await montantsVisibles(req)));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /licences/:id/maintenance/:mid error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.delete("/licences/:id/maintenance/:mid", async (req, res) => {
  const { id, mid } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    if (!UUID_RE.test(id)) { await client.query("ROLLBACK"); return introuvable(res); }
    if (!UUID_RE.test(mid)) { await client.query("ROLLBACK"); return periodeIntrouvable(res); }

    const { rows: existant } = await client.query(
      `SELECT id_mainteneur, id_commande, id_revendeur, date_debut::text AS date_debut, date_fin::text AS date_fin,
              cout::float8 AS cout, id_version
         FROM maintenance_historique WHERE id = $1 AND id_licence = $2 FOR UPDATE`, [mid, id]);
    if (!existant.length) { await client.query("ROLLBACK"); return periodeIntrouvable(res); }

    await client.query(`DELETE FROM maintenance_historique WHERE id = $1`, [mid]);
    await repercuterSurLicence(client, req, id);

    await auditer(client, req, { action: "MAINTENANCE_SUPPRIMEE", entiteType: "maintenance_historique", entiteId: mid, avant: { id_licence: id, ...existant[0] } });
    await log(client, req, "DELETE", "maintenance_historique", mid,
      `Periode de maintenance supprimee sur la licence ${id}`, null);
    await client.query("COMMIT");
    succes(res, 4008, null);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /licences/:id/maintenance/:mid error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// Arrêt et reprise de maintenance
// ---------------------------------------------------------------------------

// L'arrêt fige la version (version_figee_id, par défaut la version courante de
// la licence) et la date d'arrêt. Il ne retire aucun droit quantitatif : la
// quantité et le type ne bougent pas. Les périodes d'historique ouvertes ou
// courant au-delà sont closes à la date d'arrêt ; l'état « arrêtée » se lit
// sur date_arret_maintenance, plus aucun drapeau n'est posé (#201).
router.post("/licences/:id/arret-maintenance", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    if (!UUID_RE.test(id)) { await client.query("ROLLBACK"); return introuvable(res); }
    const avant = await lireBrute(client, id, true);
    if (!avant) { await client.query("ROLLBACK"); return introuvable(res); }

    if (avant.date_arret_maintenance) {
      await client.query("ROLLBACK");
      return erreur(res, 4040, { status: 409, message: "La maintenance de cette licence est deja arretee." });
    }
    // Sans période, rien à arrêter : la maintenance n'existe que par ses
    // périodes (#201).
    const { rowCount: nbPeriodes } = await client.query(
      `SELECT 1 FROM maintenance_historique WHERE id_licence = $1`, [id]);
    if (!nbPeriodes) {
      await client.query("ROLLBACK");
      return erreur(res, 4043, { status: 409, message: "Cette licence ne porte aucune maintenance a arreter." });
    }

    const dateArret = req.body?.date_arret_maintenance || new Date().toISOString().slice(0, 10);
    if (!DATE_RE.test(dateArret)) {
      await client.query("ROLLBACK");
      return erreur(res, 4041, { status: 400, message: "La date d'arret est invalide." });
    }
    // Version figée : celle transmise, sinon la version courante de la licence.
    // Une licence sans version connue est figée "sans version" : l'arrêt reste
    // enregistré, la version pourra être posée par une modification ultérieure.
    const versionFigee = Object.prototype.hasOwnProperty.call(req.body ?? {}, "version_figee_id")
      ? (req.body.version_figee_id || null) : avant.id_version;
    if (versionFigee && (!UUID_RE.test(versionFigee) || !(await declinaisonDuProduit("version", versionFigee, avant.id_produit)))) {
      await client.query("ROLLBACK");
      return erreur(res, 4042, { status: 400, message: "Version à figer introuvable ou étrangère au logiciel." });
    }

    // La version figée devient la version courante (D59 : la version se fige
    // à l'arrêt) ; "sans version" laisse la version courante telle quelle.
    await client.query(
      `UPDATE licence
          SET version_figee_id = $1, date_arret_maintenance = $2,
              id_version = COALESCE($1, id_version)
        WHERE id = $3`, [versionFigee, dateArret, id]);
    await journaliserVersion(client, req, {
      idLicence: id, avant: avant.id_version, apres: versionFigee ?? avant.id_version,
      evenement: "arret_maintenance", dateEffet: dateArret, force: true,
    });
    // Clôture des périodes encore ouvertes ou courant au-delà de l'arrêt, à
    // la date d'arrêt, sans jamais violer ck_maintenance_dates : une
    // maintenance arrêtée ne peut plus être "en cours" dans l'historique.
    await client.query(
      `UPDATE maintenance_historique
          SET date_fin = greatest(date_debut, $1::date)
        WHERE id_licence = $2 AND (date_fin IS NULL OR date_fin > $1::date)`, [dateArret, id]);

    const apres = await lireBrute(client, id);
    const d = diff(avant, apres);
    await auditer(client, req, { action: "MAINTENANCE_ARRETEE", entiteType: "licence", entiteId: id, avant: d.avant, apres: d.apres });
    await log(client, req, "UPDATE", "licence", id,
      `Arret de maintenance de la licence "${avant.label ?? id}" au ${dateArret}`, { date_arret_maintenance: dateArret, version_figee_id: versionFigee });
    await client.query("COMMIT");

    succes(res, 4009, await lireLicence(id, req));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /licences/:id/arret-maintenance error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// Annule un arrêt : libère la version figée et efface la date d'arrêt ; l'état
// de maintenance redevient celui que disent les périodes (#201). L'historique
// n'est pas retouché, la période close reste close ; une nouvelle période se
// saisit ensuite.
router.post("/licences/:id/reprise-maintenance", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    if (!UUID_RE.test(id)) { await client.query("ROLLBACK"); return introuvable(res); }
    const avant = await lireBrute(client, id, true);
    if (!avant) { await client.query("ROLLBACK"); return introuvable(res); }
    if (!avant.date_arret_maintenance) {
      await client.query("ROLLBACK");
      return erreur(res, 4045, { status: 409, message: "La maintenance de cette licence n'est pas arretee." });
    }

    await client.query(
      `UPDATE licence SET version_figee_id = NULL, date_arret_maintenance = NULL WHERE id = $1`, [id]);
    await journaliserVersion(client, req, {
      idLicence: id, avant: avant.version_figee_id, apres: avant.id_version,
      evenement: "reprise_maintenance", force: true,
    });

    const apres = await lireBrute(client, id);
    const d = diff(avant, apres);
    await auditer(client, req, { action: "MAINTENANCE_REPRISE", entiteType: "licence", entiteId: id, avant: d.avant, apres: d.apres });
    await log(client, req, "UPDATE", "licence", id,
      `Reprise de maintenance de la licence "${avant.label ?? id}"`, null);
    await client.query("COMMIT");

    succes(res, 4044, await lireLicence(id, req));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /licences/:id/reprise-maintenance error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// Prolongation (décision du 11/09/2026)
// ---------------------------------------------------------------------------

// Échéance prolongeable d'une licence : la date de fin de souscription quand
// le type en porte une (souscription, essai), sinon la fin de la période de
// maintenance de référence d'une licence non arrêtée (perpétuelle "via sa
// maintenance"), lue sur les périodes et jamais sur la licence (#201,
// echeanceMaintenance). Une licence sans échéance ne se prolonge pas : elle se
// modifie ou reçoit une période de maintenance.
async function echeanceProlongeable(client, licence, idLicence) {
  if (licence.date_fin_souscription) {
    return { mode: "souscription", date: licence.date_fin_souscription };
  }
  const { rows: periodes } = await client.query(
    `SELECT id, date_debut::text AS date_debut, date_fin::text AS date_fin, created_at
       FROM maintenance_historique WHERE id_licence = $1 ORDER BY date_debut, created_at`, [idLicence]);
  const echeance = echeanceMaintenance(licence, periodes);
  return echeance ? { mode: "maintenance", date: echeance.date, id_maintenance: echeance.id_maintenance } : null;
}

// Alertes d'échéance après prolongation : depuis le 16/09/2026 la clé
// d'événement du planificateur porte la date de fin (cleEcheance,
// server/utils/notifications/regles.js) : la nouvelle échéance produit
// d'elle-même une nouvelle notification au passage suivant, les notifications
// déjà émises restent dans l'historique de l'utilisateur. Plus aucune
// libération manuelle ici (migration 065 pour les clés antérieures).

// Prolonger étend la date de fin de la période en cours, sans créer de
// licence : la nouvelle date doit être postérieure à l'échéance actuelle.
// "Nouvelle période" est une création ordinaire (POST /licences) préremplie
// par le front, liée par id_licence_predecesseur : l'ancienne conserve son
// terme.
router.post("/licences/:id/prolonger", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");
    if (!UUID_RE.test(id)) { await client.query("ROLLBACK"); return introuvable(res); }
    const avant = await lireBrute(client, id, true);
    if (!avant) { await client.query("ROLLBACK"); return introuvable(res); }

    const echeance = await echeanceProlongeable(client, avant, id);
    if (!echeance) {
      await client.query("ROLLBACK");
      return erreur(res, 4026, { status: 409, message: "Cette licence ne porte aucune echeance a prolonger : ni date de fin, ni maintenance en cours." });
    }
    const nouvelleDate = req.body?.date_fin ?? null;
    if (!nouvelleDate || !DATE_RE.test(nouvelleDate)) {
      await client.query("ROLLBACK");
      return erreur(res, 4024, { status: 400, message: "La nouvelle date de fin est invalide." });
    }
    if (nouvelleDate <= echeance.date) {
      await client.query("ROLLBACK");
      return erreur(res, 4027, { status: 400, message: `La nouvelle date de fin doit etre posterieure a l'echeance actuelle (${echeance.date}).` });
    }

    let periode = null;
    if (echeance.mode === "souscription") {
      await client.query(`UPDATE licence SET date_fin_souscription = $1 WHERE id = $2`, [nouvelleDate, id]);
    } else {
      // Période de maintenance de référence (en cours, sinon à venir, sinon
      // la dernière échue), étendue à la nouvelle date. Rien n'est posé sur la
      // licence : sa fin de maintenance se lit sur la période (#201).
      await client.query(`UPDATE maintenance_historique SET date_fin = $1 WHERE id = $2`, [nouvelleDate, echeance.id_maintenance]);
      periode = { id: echeance.id_maintenance, date_fin_avant: echeance.date };
    }

    const apres = await lireBrute(client, id);
    const d = diff(avant, apres);
    await auditer(client, req, { action: "LICENCE_PROLONGEE", entiteType: "licence", entiteId: id, avant: d.avant, apres: d.apres });
    await log(client, req, "UPDATE", "licence", id,
      `Prolongation de la licence "${avant.label ?? id}" : ${echeance.mode === "souscription" ? "fin de souscription" : "fin de maintenance"} du ${echeance.date} au ${nouvelleDate}`,
      { mode: echeance.mode, date_fin_avant: echeance.date, date_fin: nouvelleDate, periode });
    await client.query("COMMIT");

    succes(res, 4025, await lireLicence(id, req));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /licences/:id/prolonger error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// Compléments du catalogue : versions et éditions ajoutées par le client
// (décision du 11/09/2026, migration 063)
// ---------------------------------------------------------------------------

// Le catalogue global (produit_referentiel, version, edition) est en lecture
// seule depuis un espace client (doctrine 001/002/040) : une version ou une
// édition qui manque au catalogue est ajoutée en Tenant, rattachée au produit
// par un lien logique, et servie avec le catalogue (GET /produits/complements,
// fusionné par le front). Doublons refusés à la casse et aux accents près,
// contre le catalogue Commune et contre les compléments déjà saisis.
const COMPLEMENTS = {
  versions: { table: "version", accord: "la version", codeAjout: 4034 },
  editions: { table: "edition", accord: "l'edition", codeAjout: 4035 },
};

// Forme de comparaison d'un libellé : minuscules, sans accents (décomposition
// Unicode puis retrait des diacritiques), espaces réduits.
export function normaliserLibelle(label) {
  return String(label ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

router.get("/produits/complements", async (req, res) => {
  try {
    const [{ rows: versions }, { rows: editions }] = await Promise.all([
      tenantPool.query(`SELECT id, id_produit, label FROM version_complement ORDER BY label`),
      tenantPool.query(`SELECT id, id_produit, label FROM edition_complement ORDER BY label`),
    ]);
    succes(res, 4038, { versions, editions });
  } catch (err) {
    console.error("GET /produits/complements error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  }
});

function ajouterComplement(type) {
  const d = COMPLEMENTS[type];
  return async (req, res) => {
    const { id } = req.params;
    const label = typeof req.body?.label === "string" ? req.body.label.trim() : "";
    const normalise = normaliserLibelle(label);
    const client = await tenantPool.connect();
    try {
      await client.query("BEGIN");
      if (!UUID_RE.test(id) || !(await produitExiste(id))) {
        await client.query("ROLLBACK");
        return erreur(res, 4012, { status: 404, message: "Logiciel introuvable au catalogue." });
      }
      if (!normalise) {
        await client.query("ROLLBACK");
        return erreur(res, 4036, { status: 400, message: `Le libelle de ${d.accord} est obligatoire.` });
      }
      if (label.length > 100) {
        await client.query("ROLLBACK");
        return erreur(res, 4036, { status: 400, message: `Le libelle de ${d.accord} ne peut pas depasser 100 caracteres.` });
      }
      // Doublon contre le catalogue Commune (comparaison faite ici, la Commune
      // ne portant pas de forme normalisée) puis contre les compléments.
      const { rows: catalogue } = await commonPool.query(
        `SELECT id, label FROM ${d.table} WHERE id_produit = $1`, [id]);
      const existante = catalogue.find((x) => normaliserLibelle(x.label) === normalise);
      const { rows: [complement] } = await client.query(
        `SELECT id, label FROM ${d.table}_complement WHERE id_produit = $1 AND label_normalise = $2`, [id, normalise]);
      if (existante || complement) {
        await client.query("ROLLBACK");
        const deja = existante ?? complement;
        return erreur(res, 4037, {
          status: 409,
          message: `Cette ${d.table} existe déjà pour ce logiciel sous le libellé "${deja.label}".`,
          details: { id: deja.id, label: deja.label, source: existante ? "catalogue" : "complement" },
        });
      }

      const { rows: [creee] } = await client.query(
        `INSERT INTO ${d.table}_complement (id_produit, label, label_normalise, id_auteur)
         VALUES ($1, $2, $3, $4) RETURNING id, id_produit, label`,
        [id, label, normalise, req?.user?.id || null]);
      await log(client, req, "CREATE", `${d.table}_complement`, creee.id,
        `Ajout de ${d.accord} "${label}" au produit ${id} (complement du catalogue)`, { id_produit: id, label });
      await client.query("COMMIT");
      succes(res, d.codeAjout, { ...creee, source: "complement" }, { status: 201 });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`POST /produits/:id/${type} error`, err);
      erreur(res, 4099, { status: 500, message: "Erreur serveur" });
    } finally {
      client.release();
    }
  };
}

router.post("/produits/:id/versions", ajouterComplement("versions"));
router.post("/produits/:id/editions", ajouterComplement("editions"));

export default router;
