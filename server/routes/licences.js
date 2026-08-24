// licences - patrimoine des droits acquis (US #102, module 3 partie A).
//
// Meme convention que contrats.js et commandes.js : enveloppe normalisee
// (server/utils/reponse.js, codes 4000-4099 seedes par la migration 028),
// helper log() vers journal_ecriture avec id_auteur, trace probante auditer()
// vers audit_log sur chaque ecriture, controle d'existence des references avant
// INSERT, transaction par ecriture, relecture de la projection apres commit.
//
// Le contrat n'est jamais rattache directement a la licence : il se deduit de
// la commande (licence.id_commande -> commande.id_contrat), la migration 014
// ayant supprime licence.id_contrat. La societe payeuse suit la meme chaine
// (commande.id_societe), conformement a la doctrine budget.
//
// produit, edition et version vivent en BDD Commune : aucune jointure SQL
// possible, les libelles sont resolus ici apres lecture (resoudreCatalogue).
import express from "express";
import { tenantPool, commonPool } from "../db.js";
import { succes, erreur, erreurPivot } from "../utils/reponse.js";
import { auditer, diff } from "../utils/audit.js";
import { permissionsEffectives } from "../utils/droitsUtilisateur.js";

const router = express.Router();

// Convention du projet : helper de journalisation local a chaque routeur.
// id_auteur est lu dans req.user (session JWT) : le routeur est monte apres
// authMiddleware, req.user est donc toujours renseigne.
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
const TYPES = ["perpetuelle", "souscription"];

// Souscription echue : le jour meme de sa date de fin, sans tolerance
// (hypothese v0.5 assumee). Une perpetuelle n'expire jamais. Une souscription
// sans date de fin (donnee anterieure a la validation) reste active.
const EXPIREE = `(l.type = 'souscription' AND l.date_fin_souscription IS NOT NULL
                  AND l.date_fin_souscription < CURRENT_DATE)`;

// Statut d'echeance : meme vocabulaire que contrats et commandes, pour que
// StatutEcheanceBadge serve les trois ecrans. Source unique, jamais recalcule
// cote front.
const STATUT_ECHEANCE = `
  CASE
    WHEN l.type = 'perpetuelle' OR l.date_fin_souscription IS NULL          THEN 'perpetuel'
    WHEN l.date_fin_souscription < CURRENT_DATE                               THEN 'expire'
    WHEN l.date_fin_souscription <= CURRENT_DATE + INTERVAL '90 days'         THEN 'a_renouveler'
    ELSE 'actif'
  END AS statut_echeance`;

// Statut de maintenance : arretee (version figee) prime sur tout, puis echue
// si la date de fin est depassee, active, ou aucune.
const STATUT_MAINTENANCE = `
  CASE
    WHEN l.date_arret_maintenance IS NOT NULL                                  THEN 'arretee'
    WHEN NOT l.a_maintenance                                                   THEN 'aucune'
    WHEN l.date_fin_maintenance IS NOT NULL AND l.date_fin_maintenance < CURRENT_DATE THEN 'echue'
    ELSE 'active'
  END AS statut_maintenance`;

// Balance de conformite par produit : droits = quantites des licences non
// expirees, usage declare = affectations de toutes les licences du produit
// (un usage declare sur une licence echue reste un usage). Seuils repris de
// l'ancien mock : depassement au-dela des droits, attention a 90 %.
const SELECT_LICENCE = `
  WITH usage_licence AS (
    SELECT a.id_licence, sum(a.quantite)::int AS quantite
      FROM affectation a
     GROUP BY a.id_licence
  ), balance AS (
    SELECT l.id_produit,
           coalesce(sum(l.quantite) FILTER (WHERE NOT ${EXPIREE}), 0)::int AS droits,
           coalesce(sum(u.quantite), 0)::int AS usage_declare
      FROM licence l
      LEFT JOIN usage_licence u ON u.id_licence = l.id
     GROUP BY l.id_produit
  )
  SELECT l.id, l.label,
         l.id_produit, l.id_edition, l.id_version, l.version_figee_id,
         l.id_commande,     c.label          AS commande_label,
         c.id_contrat,      ct.label         AS contrat_label,
         c.id_societe,      s.raison_sociale AS societe_label,
         l.id_revendeur,    r.raison_sociale AS revendeur_label,
         l.id_unite_mesure, um.code AS unite_code, um.label AS unite_label,
         l.id_mainteneur,   m.raison_sociale AS mainteneur_label,
         l.quantite, l.type,
         l.cout_licence::float8 AS cout_licence,
         l.date_fin_souscription::text  AS date_fin_souscription,
         l.a_maintenance,
         l.date_arret_maintenance::text AS date_arret_maintenance,
         l.date_fin_maintenance::text   AS date_fin_maintenance,
         l.created_at,
         ${STATUT_ECHEANCE},
         CASE WHEN l.type = 'perpetuelle' OR l.date_fin_souscription IS NULL THEN NULL
              ELSE (l.date_fin_souscription - CURRENT_DATE) END AS jours_restants,
         NOT ${EXPIREE} AS droits_actifs,
         ${STATUT_MAINTENANCE},
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
  LEFT JOIN societe      s  ON s.id  = c.id_societe
  LEFT JOIN revendeur    r  ON r.id  = l.id_revendeur
  LEFT JOIN unite_mesure um ON um.id = l.id_unite_mesure
  LEFT JOIN mainteneur   m  ON m.id  = l.id_mainteneur
  LEFT JOIN usage_licence ul ON ul.id_licence = l.id
  LEFT JOIN balance      b  ON b.id_produit = l.id_produit`;

const SELECT_MAINTENANCE = `
  SELECT h.id, h.id_licence,
         h.id_mainteneur, m.raison_sociale AS mainteneur_label,
         h.id_revendeur,  r.raison_sociale AS revendeur_label,
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
    LEFT JOIN mainteneur m ON m.id = h.id_mainteneur
    LEFT JOIN revendeur  r ON r.id = h.id_revendeur`;

const CHAMPS = [
  "label", "id_produit", "id_edition", "id_version", "id_commande", "id_revendeur",
  "id_unite_mesure", "quantite", "type", "cout_licence", "date_fin_souscription",
  "a_maintenance", "id_mainteneur", "date_fin_maintenance",
];

// ---------------------------------------------------------------------------
// Resolution du catalogue (BDD Commune) et masquage des montants
// ---------------------------------------------------------------------------

// Pose produit_label, produit_sku, id_editeur, editeur_label, edition_label,
// version_label et version_figee_label sur chaque ligne. Une seule requete
// Commune pour les produits, une pour editions et versions, une Tenant pour
// les editeurs : jamais une requete par ligne.
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
// DSI et Financier la detiennent, IT Ops non. Meme calcul que le middleware
// (droitsUtilisateur.js) : le front applique la meme regle par hasPermission.
// Les montants masques sortent a null avec montants_masques = true, jamais
// caviardes en chaine : un consommateur ne doit pas confondre "masque" et "0".
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

async function lireLicence(id, req) {
  const { rows } = await tenantPool.query(`${SELECT_LICENCE} WHERE l.id = $1`, [id]);
  if (!rows.length) return null;
  const [resolue] = await resoudreCatalogue(rows);
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

// Reference vers la BDD Commune : produit, ou declinaison rattachee au produit.
async function produitExiste(id) {
  const { rowCount } = await commonPool.query(`SELECT 1 FROM produit_referentiel WHERE id = $1`, [id]);
  return rowCount > 0;
}
async function declinaisonDuProduit(table, id, idProduit) {
  if (!id) return true;
  const { rowCount } = await commonPool.query(
    `SELECT 1 FROM ${table} WHERE id = $1 AND id_produit = $2`, [id, idProduit]);
  return rowCount > 0;
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
    date_fin_souscription: vide(body.date_fin_souscription),
    a_maintenance: body.a_maintenance === true,
    id_mainteneur: vide(body.id_mainteneur),
    date_fin_maintenance: vide(body.date_fin_maintenance),
  };
}

// Les UUID sont controles avant toute requete : un UUID malforme part sinon en
// Postgres et ressort en 22P02 illisible la ou la reference est simplement
// introuvable.
const uuidValide = (v) => !v || UUID_RE.test(v);

async function validerLicence(client, corps) {
  const c = corps;
  if (!c.id_produit)
    return { status: 400, code: 4011, error: "Le produit est obligatoire." };
  if (!uuidValide(c.id_produit) || !(await produitExiste(c.id_produit)))
    return { status: 400, code: 4012, error: "Produit introuvable au catalogue." };
  if (!uuidValide(c.id_edition) || !(await declinaisonDuProduit("edition", c.id_edition, c.id_produit)))
    return { status: 400, code: 4013, error: "Edition introuvable ou etrangere au produit." };
  if (!uuidValide(c.id_version) || !(await declinaisonDuProduit("version", c.id_version, c.id_produit)))
    return { status: 400, code: 4014, error: "Version introuvable ou etrangere au produit." };
  if (!uuidValide(c.id_commande) || !(await existe(client, "commande", c.id_commande)))
    return { status: 400, code: 4015, error: "Commande introuvable." };
  if (!uuidValide(c.id_revendeur) || !(await existe(client, "revendeur", c.id_revendeur)))
    return { status: 400, code: 4016, error: "Revendeur introuvable." };
  if (!uuidValide(c.id_unite_mesure) || !(await existe(client, "unite_mesure", c.id_unite_mesure)))
    return { status: 400, code: 4017, error: "Unite de mesure introuvable." };
  if (!TYPES.includes(c.type))
    return { status: 400, code: 4018, error: "Le type de licence doit etre perpetuelle ou souscription." };
  // Zero accepte : c'est la borne du CHECK licence_quantite_check, et une
  // licence a zero droit reste un fait (lot epuise, retire). Le front impose 1.
  if (!Number.isInteger(c.quantite) || c.quantite < 0)
    return { status: 400, code: 4019, error: "La quantite doit etre un entier positif ou nul." };
  if (c.cout_licence !== null && (!Number.isFinite(c.cout_licence) || c.cout_licence < 0))
    return { status: 400, code: 4020, error: "Le cout doit etre un montant positif ou nul." };
  if (c.type === "souscription" && !c.date_fin_souscription)
    return { status: 400, code: 4021, error: "La date de fin de souscription est obligatoire pour une souscription." };
  if (c.date_fin_souscription && !DATE_RE.test(c.date_fin_souscription))
    return { status: 400, code: 4024, error: "La date de fin de souscription est invalide." };
  if (c.date_fin_maintenance && !DATE_RE.test(c.date_fin_maintenance))
    return { status: 400, code: 4024, error: "La date de fin de maintenance est invalide." };
  if (!uuidValide(c.id_mainteneur) || !(await existe(client, "mainteneur", c.id_mainteneur)))
    return { status: 400, code: 4022, error: "Mainteneur introuvable." };
  return null;
}

// Une perpetuelle ne porte pas de date de fin de souscription : elle est
// effacee plutot que refusee, un changement de type ne doit pas obliger a
// vider le champ a la main.
function coherer(corps) {
  if (corps.type === "perpetuelle") corps.date_fin_souscription = null;
  return corps;
}

function normaliserMaintenance(body = {}) {
  const vide = (v) => (v === "" || v === undefined ? null : v);
  const cout = vide(body.cout);
  return {
    id_mainteneur: vide(body.id_mainteneur),
    id_revendeur: vide(body.id_revendeur),
    date_debut: vide(body.date_debut),
    date_fin: vide(body.date_fin),
    cout: cout === null ? null : Number(cout),
  };
}

async function validerMaintenance(client, m) {
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
  if (!uuidValide(m.id_revendeur) || !(await existe(client, "revendeur", m.id_revendeur)))
    return { status: 400, code: 4016, error: "Revendeur introuvable." };
  return null;
}

const CHAMPS_MAINTENANCE = ["id_mainteneur", "id_revendeur", "date_debut", "date_fin", "cout"];

// Etat de la licence tel qu'il est audite : les colonnes brutes, pas la
// projection (les libelles resolus ne sont pas des donnees de la licence).
const COLONNES_BRUTES = `label, id_produit, id_edition, id_version, id_commande, id_revendeur,
    id_unite_mesure, quantite, type, cout_licence::float8 AS cout_licence,
    date_fin_souscription::text AS date_fin_souscription, a_maintenance,
    version_figee_id, date_arret_maintenance::text AS date_arret_maintenance,
    id_mainteneur, date_fin_maintenance::text AS date_fin_maintenance`;

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
    if (type && !TYPES.includes(type))
      return erreur(res, 4018, { status: 400, message: "Le type de licence doit etre perpetuelle ou souscription." });

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
    const resolues = await resoudreCatalogue(rows);
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

    // Compteurs de rattachements, les memes que le garde-fou de suppression.
    const { rows: [liens] } = await tenantPool.query(
      `SELECT (SELECT count(*) FROM affectation             WHERE id_licence = $1)::int AS nb_affectations,
              (SELECT count(*) FROM budget                  WHERE id_licence = $1)::int AS nb_budgets,
              (SELECT count(*) FROM maintenance_historique  WHERE id_licence = $1)::int AS nb_maintenances`,
      [id]);
    succes(res, 4001, { ...licence, ...liens });
  } catch (err) {
    console.error("GET /licences/:id error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  }
});

router.post("/licences", async (req, res) => {
  const corps = coherer(normaliserCorps(req.body));
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
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      CHAMPS.map((ch) => corps[ch]));

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

    // Fusion avant validation : un PATCH partiel ne doit pas echouer sur un
    // champ obligatoire qui n'a simplement pas ete transmis.
    const patch = normaliserCorps(req.body);
    const corps = {};
    for (const champ of CHAMPS) {
      corps[champ] = Object.prototype.hasOwnProperty.call(req.body, champ) ? patch[champ] : avant[champ];
    }
    coherer(corps);

    const invalide = await validerLicence(client, corps);
    if (invalide) { await client.query("ROLLBACK"); return erreurPivot(res, invalide); }

    // Changer de produit invalide une version figee qui lui etait propre.
    const versionFigee = corps.id_produit === avant.id_produit ? avant.version_figee_id : null;

    await client.query(
      `UPDATE licence
          SET ${CHAMPS.map((ch, i) => `${ch} = $${i + 1}`).join(", ")},
              version_figee_id = $${CHAMPS.length + 1}
        WHERE id = $${CHAMPS.length + 2}`,
      [...CHAMPS.map((ch) => corps[ch]), versionFigee, id]);

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
    // de maintenance tombe avec la licence (ON DELETE CASCADE), il n'est pas
    // bloquant.
    const { rows: [liens] } = await client.query(
      `SELECT (SELECT count(*) FROM affectation WHERE id_licence = $1) AS affectations,
              (SELECT count(*) FROM budget      WHERE id_licence = $1) AS budgets`,
      [id]);
    const bloquants = [];
    if (+liens.affectations) bloquants.push(`${liens.affectations} affectation(s)`);
    if (+liens.budgets)      bloquants.push(`${liens.budgets} ligne(s) budgetaire(s)`);
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
    succes(res, 4005, rows.map((r) => masquerMaintenance(r, visibles)));
  } catch (err) {
    console.error("GET /licences/:id/maintenance error", err);
    erreur(res, 4099, { status: 500, message: "Erreur serveur" });
  }
});

// Ajouter une periode signifie que la licence est sous maintenance : le
// drapeau passe a true (sauf maintenance arretee, que seule la reprise leve)
// et la date de fin de maintenance de la licence s'aligne sur la fin la plus
// lointaine connue.
async function repercuterSurLicence(client, idLicence) {
  await client.query(
    `UPDATE licence l
        SET a_maintenance = CASE WHEN l.date_arret_maintenance IS NULL THEN true ELSE l.a_maintenance END,
            date_fin_maintenance = CASE WHEN l.date_arret_maintenance IS NULL
              THEN (SELECT max(h.date_fin) FROM maintenance_historique h WHERE h.id_licence = l.id)
              ELSE l.date_fin_maintenance END
      WHERE l.id = $1`, [idLicence]);
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

    const invalide = await validerMaintenance(client, m);
    if (invalide) { await client.query("ROLLBACK"); return erreurPivot(res, invalide); }

    const { rows: [creee] } = await client.query(
      `INSERT INTO maintenance_historique (id_licence, ${CHAMPS_MAINTENANCE.join(", ")})
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [id, ...CHAMPS_MAINTENANCE.map((ch) => m[ch])]);
    await repercuterSurLicence(client, id);

    await auditer(client, req, { action: "MAINTENANCE_AJOUTEE", entiteType: "maintenance_historique", entiteId: creee.id, apres: { id_licence: id, ...m } });
    await log(client, req, "CREATE", "maintenance_historique", creee.id,
      `Periode de maintenance ajoutee sur la licence ${id}`, m);
    await client.query("COMMIT");

    const { rows } = await tenantPool.query(`${SELECT_MAINTENANCE} WHERE h.id = $1`, [creee.id]);
    succes(res, 4006, masquerMaintenance(rows[0], await montantsVisibles(req)), { status: 201 });
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

    const { rows: existant } = await client.query(
      `SELECT id_mainteneur, id_revendeur, date_debut::text AS date_debut, date_fin::text AS date_fin,
              cout::float8 AS cout
         FROM maintenance_historique WHERE id = $1 AND id_licence = $2 FOR UPDATE`, [mid, id]);
    if (!existant.length) { await client.query("ROLLBACK"); return periodeIntrouvable(res); }

    const patch = normaliserMaintenance(req.body);
    const m = { ...existant[0] };
    for (const ch of CHAMPS_MAINTENANCE) {
      if (Object.prototype.hasOwnProperty.call(req.body, ch)) m[ch] = patch[ch];
    }
    const invalide = await validerMaintenance(client, m);
    if (invalide) { await client.query("ROLLBACK"); return erreurPivot(res, invalide); }

    await client.query(
      `UPDATE maintenance_historique
          SET ${CHAMPS_MAINTENANCE.map((ch, i) => `${ch} = $${i + 1}`).join(", ")}
        WHERE id = $${CHAMPS_MAINTENANCE.length + 1}`,
      [...CHAMPS_MAINTENANCE.map((ch) => m[ch]), mid]);
    await repercuterSurLicence(client, id);

    const d = diff(existant[0], m);
    await auditer(client, req, { action: "MAINTENANCE_MODIFIEE", entiteType: "maintenance_historique", entiteId: mid, avant: d.avant, apres: d.apres });
    await log(client, req, "UPDATE", "maintenance_historique", mid,
      `Periode de maintenance modifiee sur la licence ${id}`, patch);
    await client.query("COMMIT");

    const { rows } = await tenantPool.query(`${SELECT_MAINTENANCE} WHERE h.id = $1`, [mid]);
    succes(res, 4007, masquerMaintenance(rows[0], await montantsVisibles(req)));
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
      `SELECT id_mainteneur, id_revendeur, date_debut::text AS date_debut, date_fin::text AS date_fin,
              cout::float8 AS cout
         FROM maintenance_historique WHERE id = $1 AND id_licence = $2 FOR UPDATE`, [mid, id]);
    if (!existant.length) { await client.query("ROLLBACK"); return periodeIntrouvable(res); }

    await client.query(`DELETE FROM maintenance_historique WHERE id = $1`, [mid]);
    await repercuterSurLicence(client, id);

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
// Arret et reprise de maintenance
// ---------------------------------------------------------------------------

// L'arret fige la version (version_figee_id, par defaut la version courante de
// la licence) et la date d'arret. Il ne retire aucun droit quantitatif : la
// quantite et le type ne bougent pas. Les periodes d'historique ouvertes ou
// courant au-dela sont closes a la date d'arret, et a_maintenance passe a false.
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
    const { rowCount: nbPeriodes } = await client.query(
      `SELECT 1 FROM maintenance_historique WHERE id_licence = $1`, [id]);
    if (!avant.a_maintenance && !nbPeriodes) {
      await client.query("ROLLBACK");
      return erreur(res, 4043, { status: 409, message: "Cette licence ne porte aucune maintenance a arreter." });
    }

    const dateArret = req.body?.date_arret_maintenance || new Date().toISOString().slice(0, 10);
    if (!DATE_RE.test(dateArret)) {
      await client.query("ROLLBACK");
      return erreur(res, 4041, { status: 400, message: "La date d'arret est invalide." });
    }
    // Version figee : celle transmise, sinon la version courante de la licence.
    // Une licence sans version connue est figee "sans version" : l'arret reste
    // enregistre, la version pourra etre posee par une modification ulterieure.
    const versionFigee = Object.prototype.hasOwnProperty.call(req.body ?? {}, "version_figee_id")
      ? (req.body.version_figee_id || null) : avant.id_version;
    if (versionFigee && (!UUID_RE.test(versionFigee) || !(await declinaisonDuProduit("version", versionFigee, avant.id_produit)))) {
      await client.query("ROLLBACK");
      return erreur(res, 4042, { status: 400, message: "Version a figer introuvable ou etrangere au produit." });
    }

    await client.query(
      `UPDATE licence
          SET a_maintenance = false, version_figee_id = $1, date_arret_maintenance = $2,
              date_fin_maintenance = $2
        WHERE id = $3`, [versionFigee, dateArret, id]);
    // Cloture des periodes encore ouvertes ou courant au-dela de l'arret, a
    // la date d'arret, sans jamais violer ck_maintenance_dates : une
    // maintenance arretee ne peut plus etre "en cours" dans l'historique.
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

// Annule un arret : libere la version figee et remet la licence sous
// maintenance. L'historique n'est pas retouche, la periode close reste close ;
// une nouvelle periode se saisit ensuite.
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
      `UPDATE licence
          SET a_maintenance = true, version_figee_id = NULL, date_arret_maintenance = NULL,
              date_fin_maintenance = (SELECT max(h.date_fin) FROM maintenance_historique h WHERE h.id_licence = $1)
        WHERE id = $1`, [id]);

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

export default router;
