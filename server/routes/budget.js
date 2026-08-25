// budget - lignes budgetaires par licence, previsionnel et alloue (US #146,
// module 4 partie A).
//
// Meme convention que licences.js et commandes.js : enveloppe normalisee
// (server/utils/reponse.js, codes 5100-5199 seedes par la migration 034),
// helper log() vers journal_ecriture avec id_auteur, trace probante auditer()
// vers audit_log sur chaque ecriture, controle d'existence des references avant
// INSERT, transaction par ecriture, relecture de la projection apres commit.
//
// Doctrine budget : l'organisation payeuse n'est JAMAIS stockee ni saisie sur
// la ligne. Elle se deduit de la chaine licence -> commande d'origine ->
// societe (commande.id_societe), et l'editeur du contrat de cette commande
// (contrat.id_editeur). La table budget ne porte que id_licence.
//
// Previsionnel et alloue vivent dans la table budget. L'engage vient des
// donnees reelles, les commandes, lues dans precalcul_financier (016, 017) ou
// directement dans commande quand le filtre descend a la licence ou au contrat
// (le precalcul n'a pas ces axes) : jamais melange au previsionnel saisi, pas
// de double previsionnel.
//
// Exercices fiscaux : fonctions SQL exercice_fiscal_de / _debut / _fin
// (migration 033), source unique. Un exercice est identifie par l'annee
// civile de son premier jour ; le debut d'exercice est celui de la societe
// payeuse, a defaut celui du tenant (tenant_config), a defaut le 1er janvier.
//
// Les montants ne sont pas masques ici : la US donne la lecture du module a
// IT Ops sans reserve, et une ligne budgetaire est par nature un montant.
import express from "express";
import { tenantPool, commonPool } from "../db.js";
import { succes, erreur, erreurPivot } from "../utils/reponse.js";
import { auditer, diff } from "../utils/audit.js";

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
const TYPES = ["previsionnel", "alloue"];

// Facteur d'inflation constant impose par la US (3,5 % par an). Les colonnes
// tenant_config.taux_hausse_annuelle_defaut et editeur.taux_hausse_annuelle
// existent et pourront le remplacer par decision ulterieure ; elles ne sont
// pas lues ici.
const TAUX_INFLATION = 0.035;

// Borne de DECIMAL(12,2) : au-dela, Postgres repond 22003 en 500 illisible.
const MAX_DECIMAL = 9999999999.99;

// Debut d'exercice applicable a une ligne : societe payeuse, sinon tenant,
// sinon 1er janvier (sentinelle 2000, seuls jour et mois significatifs).
// tenant_config est a ligne unique ; le LATERAL ... LIMIT 1 garantit qu'une
// base sans ligne (aucun tenant provisionne) ou avec plusieurs ne casse ni ne
// duplique rien.
const JOIN_TENANT = `LEFT JOIN LATERAL (SELECT debut_exercice_fiscal_defaut FROM tenant_config LIMIT 1) tc ON true`;
const DEBUT_EXERCICE = `COALESCE(s.debut_exercice_fiscal, tc.debut_exercice_fiscal_defaut, DATE '2000-01-01')`;

// Projection identique en liste et en detail. Tout ce qui n'est pas une
// colonne de budget est deduit : commande, contrat, editeur et societe par la
// chaine, exercice par la fonction 033 sur date_debut.
const SELECT_BUDGET = `
  SELECT b.id, b.id_licence, b.type,
         b.montant_capex::float8  AS montant_capex,
         b.quantite_capex::float8 AS quantite_capex,
         b.date_capex::text       AS date_capex,
         b.montant_opex::float8   AS montant_opex,
         b.quantite_opex::float8  AS quantite_opex,
         b.date_debut::text       AS date_debut,
         b.date_fin::text         AS date_fin,
         (COALESCE(b.montant_capex, 0) + COALESCE(b.montant_opex, 0))::float8 AS montant_total,
         b.created_at,
         l.label       AS licence_label,
         l.id_produit,
         l.type        AS licence_type,
         l.quantite    AS licence_quantite,
         l.id_commande,     c.label           AS commande_label,
         c.montant::float8  AS commande_montant,
         c.date_commande::text AS commande_date,
         c.id_contrat,      ct.label          AS contrat_label,
         ct.id_editeur,     e.raison_sociale  AS editeur_label,
         c.id_societe,      s.raison_sociale  AS societe_label,
         ${DEBUT_EXERCICE}::text AS debut_exercice_fiscal,
         exercice_fiscal_de(b.date_debut, ${DEBUT_EXERCICE}) AS exercice
  FROM budget b
  JOIN licence       l  ON l.id  = b.id_licence
  LEFT JOIN commande c  ON c.id  = l.id_commande
  LEFT JOIN contrat  ct ON ct.id = c.id_contrat
  LEFT JOIN editeur  e  ON e.id  = ct.id_editeur
  LEFT JOIN societe  s  ON s.id  = c.id_societe
  ${JOIN_TENANT}`;

const CHAMPS = [
  "id_licence", "type", "montant_capex", "quantite_capex", "date_capex",
  "montant_opex", "quantite_opex", "date_debut", "date_fin",
];

// ---------------------------------------------------------------------------
// Resolution du catalogue (BDD Commune)
// ---------------------------------------------------------------------------

// Les produits vivent en BDD Commune : aucune jointure possible, l'API fait le
// pont. Une requete par reponse, jamais une par ligne.
async function resoudreProduits(rows) {
  const ids = [...new Set(rows.map((r) => r.id_produit).filter(Boolean))];
  const produits = new Map();
  if (ids.length) {
    const { rows: p } = await commonPool.query(
      `SELECT id, label, sku FROM produit_referentiel WHERE id = ANY($1::uuid[])`, [ids]);
    for (const x of p) produits.set(x.id, x);
  }
  return rows.map((r) => ({
    ...r,
    produit_label: produits.get(r.id_produit)?.label ?? null,
    produit_sku: produits.get(r.id_produit)?.sku ?? null,
  }));
}

async function lireLigne(id) {
  const { rows } = await tenantPool.query(`${SELECT_BUDGET} WHERE b.id = $1`, [id]);
  if (!rows.length) return null;
  const [resolue] = await resoudreProduits(rows);
  return resolue;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

async function existe(client, table, id) {
  if (!id) return true;
  const { rowCount } = await client.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
  return rowCount > 0;
}

const uuidValide = (v) => !v || UUID_RE.test(v);

// Format ISO et date reelle : "2026-02-30" passe l'expression reguliere mais
// sortirait en 22008 brute. Comparaison sur la forme normalisee pour refuser
// aussi les depassements que Date recale (le 30 fevrier devient le 2 mars).
function dateValide(s) {
  if (!DATE_RE.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

const montantValide = (v) => Number.isFinite(v) && v >= 0 && v <= MAX_DECIMAL;

// Un <select> vide et un <input type="date"> vide envoient "" et non null ;
// Number("") vaut 0, d'ou le passage par vide() avant conversion.
function normaliserCorps(body = {}) {
  const vide = (v) => (v === "" || v === undefined ? null : v);
  const nombre = (v) => (vide(v) === null ? null : Number(v));
  return {
    id_licence: vide(body.id_licence),
    type: vide(body.type),
    montant_capex: nombre(body.montant_capex),
    quantite_capex: nombre(body.quantite_capex),
    date_capex: vide(body.date_capex),
    montant_opex: nombre(body.montant_opex),
    quantite_opex: nombre(body.quantite_opex),
    date_debut: vide(body.date_debut),
    date_fin: vide(body.date_fin),
  };
}

async function validerBudget(client, c) {
  if (!c.id_licence)
    return { status: 400, code: 5111, error: "La licence est obligatoire." };
  if (!uuidValide(c.id_licence) || !(await existe(client, "licence", c.id_licence)))
    return { status: 400, code: 5112, error: "Licence introuvable." };
  if (!TYPES.includes(c.type))
    return { status: 400, code: 5113, error: "Le type doit etre previsionnel ou alloue." };
  if (!c.date_debut)
    return { status: 400, code: 5114, error: "La date de debut est obligatoire." };
  if (!c.date_fin)
    return { status: 400, code: 5115, error: "La date de fin est obligatoire." };
  if (!dateValide(c.date_debut) || !dateValide(c.date_fin) || (c.date_capex && !dateValide(c.date_capex)))
    return { status: 400, code: 5117, error: "Date invalide." };
  // Doublon volontaire de ck_budget_periode : la contrainte produirait une
  // 23514 en 500, on veut un 400 lisible.
  if (c.date_fin < c.date_debut)
    return { status: 400, code: 5116, error: "La date de fin doit etre posterieure ou egale a la date de debut." };
  if (c.montant_capex !== null && !montantValide(c.montant_capex))
    return { status: 400, code: 5118, error: "Le montant CAPEX doit etre un montant positif ou nul." };
  if (c.quantite_capex !== null && !montantValide(c.quantite_capex))
    return { status: 400, code: 5119, error: "La quantite CAPEX doit etre un nombre positif ou nul." };
  if (c.montant_opex !== null && !montantValide(c.montant_opex))
    return { status: 400, code: 5120, error: "Le montant OPEX doit etre un montant positif ou nul." };
  if (c.quantite_opex !== null && !montantValide(c.quantite_opex))
    return { status: 400, code: 5121, error: "La quantite OPEX doit etre un nombre positif ou nul." };
  // Doublon de ck_budget_un_montant. Zero reste admis : un alloue a zero est
  // une decision, pas une absence de saisie.
  if (c.montant_capex === null && c.montant_opex === null)
    return { status: 400, code: 5122, error: "Une ligne budgetaire porte au moins un montant, CAPEX ou OPEX." };
  return null;
}

// Etat de la ligne tel qu'il est audite : les colonnes brutes, pas la
// projection (les libelles deduits ne sont pas des donnees de la ligne).
const COLONNES_BRUTES = `id_licence, type,
    montant_capex::float8 AS montant_capex, quantite_capex::float8 AS quantite_capex,
    date_capex::text AS date_capex,
    montant_opex::float8 AS montant_opex, quantite_opex::float8 AS quantite_opex,
    date_debut::text AS date_debut, date_fin::text AS date_fin`;

async function lireBrute(client, id, verrou = false) {
  const { rows } = await client.query(
    `SELECT ${COLONNES_BRUTES} FROM budget WHERE id = $1${verrou ? " FOR UPDATE" : ""}`, [id]);
  return rows[0] ?? null;
}

const introuvable = (res) => erreur(res, 5110, { status: 404, message: "Ligne budgetaire introuvable." });

// ---------------------------------------------------------------------------
// Bornes d'exercice et de periode, communes a la liste, a l'engage et a la
// synthese
// ---------------------------------------------------------------------------

// Debut d'exercice applicable : celui de la societe demandee, sinon celui du
// tenant. Renvoie null si la societe n'existe pas.
async function debutExercice(idSociete) {
  const { rows: [r] } = await tenantPool.query(
    `SELECT s.id AS id_societe,
            COALESCE(s.debut_exercice_fiscal, tc.debut_exercice_fiscal_defaut, DATE '2000-01-01')::text AS debut
       FROM (SELECT 1) x
       LEFT JOIN societe s ON s.id = $1::uuid
       ${JOIN_TENANT}`,
    [idSociete || null]);
  if (idSociete && !r.id_societe) return null;
  return r.debut;
}

// Deux modes, comme /commandes/agregats : exercice fiscal (par defaut
// l'exercice courant de la societe ou du tenant), ou plage date_debut /
// date_fin libre. Renvoie soit { pivot } (refus), soit { bornes }.
async function resoudreBornes(query) {
  const { exercice, date_debut, date_fin, id_societe } = query;

  if (id_societe && !UUID_RE.test(id_societe))
    return { pivot: { status: 400, code: 5123, error: "Identifiant de societe invalide." } };

  if (date_debut !== undefined || date_fin !== undefined) {
    if (!dateValide(date_debut || "") || !dateValide(date_fin || "") || date_fin < date_debut)
      return { pivot: { status: 400, code: 5125, error: "La periode demandee est invalide." } };
    return { bornes: { mode: "periode", exercice: null, exercice_courant: null,
                       date_debut, date_fin, debut_exercice_fiscal: null } };
  }

  let ex = null;
  if (exercice !== undefined) {
    ex = Number(exercice);
    if (!Number.isInteger(ex) || ex < 1970 || ex > 2999)
      return { pivot: { status: 400, code: 5124, error: "L'exercice demande est invalide." } };
  }

  const debut = await debutExercice(id_societe);
  if (debut === null)
    return { pivot: { status: 400, code: 5126, error: "Societe introuvable." } };

  const { rows: [b] } = await tenantPool.query(
    `SELECT exercice_fiscal_de(CURRENT_DATE, $2::date) AS courant,
            COALESCE($1::int, exercice_fiscal_de(CURRENT_DATE, $2::date)) AS exercice,
            exercice_fiscal_debut(COALESCE($1::int, exercice_fiscal_de(CURRENT_DATE, $2::date)), $2::date)::text AS date_debut,
            exercice_fiscal_fin(COALESCE($1::int, exercice_fiscal_de(CURRENT_DATE, $2::date)), $2::date)::text AS date_fin`,
    [ex, debut]);

  return { bornes: { mode: "exercice", exercice: b.exercice, exercice_courant: b.courant,
                     date_debut: b.date_debut, date_fin: b.date_fin, debut_exercice_fiscal: debut } };
}

// Bornes mensuelles d'une plage : le precalcul etant mensuel, une plage au
// jour pres est servie au mois pres et les bornes appliquees sont renvoyees.
function moisEntre(debut, fin) {
  const out = [];
  let [a, m] = debut.split("-").map(Number);
  const [af, mf] = fin.split("-").map(Number);
  while (a < af || (a === af && m <= mf)) {
    out.push(`${a}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; a++; }
  }
  return out;
}

const centime = (x) => Math.round(x * 100) / 100;

// Filtres d'axe communs a l'engage et a la synthese. Renvoie { pivot } ou
// { filtres }.
function lireFiltresAxes(query) {
  const filtres = {};
  for (const cle of ["id_societe", "id_editeur", "id_contrat", "id_licence"]) {
    const v = query[cle] || null;
    if (v && !UUID_RE.test(v))
      return { pivot: { status: 400, code: 5123, error: `Identifiant de filtre invalide (${cle}).` } };
    filtres[cle] = v;
  }
  return { filtres };
}

// Engage par mois, lu dans les donnees reelles. Source precalcul_financier
// (axes editeur, societe, periode) tant que le filtre reste sur ces axes ;
// des qu'il descend au contrat ou a la licence, axes que le precalcul n'a
// pas, lecture directe de commande, sa source de verite (016 : "le precalcul
// n'est qu'un cache"). Les deux chemins produisent les memes mesures.
async function lireEngage(moisDebut, moisFin, f) {
  const parLicenceOuContrat = f.id_contrat || f.id_licence;
  const { rows } = parLicenceOuContrat
    ? await tenantPool.query(
        `SELECT to_char(c.date_commande, 'YYYY-MM') AS periode,
                sum(c.montant)::float8 AS montant_commande,
                COALESCE(sum(c.montant) FILTER (WHERE c.a_renouveler), 0)::float8 AS montant_a_renouveler,
                count(*)::int AS nb_commandes,
                (count(*) FILTER (WHERE c.a_renouveler))::int AS nb_a_renouveler
           FROM commande c
           LEFT JOIN contrat ct ON ct.id = c.id_contrat
          WHERE c.date_commande IS NOT NULL
            AND to_char(c.date_commande, 'YYYY-MM') BETWEEN $1 AND $2
            AND ($3::uuid IS NULL OR c.id_societe  = $3::uuid)
            AND ($4::uuid IS NULL OR ct.id_editeur = $4::uuid)
            AND ($5::uuid IS NULL OR c.id_contrat  = $5::uuid)
            AND ($6::uuid IS NULL OR EXISTS (SELECT 1 FROM licence l WHERE l.id = $6::uuid AND l.id_commande = c.id))
          GROUP BY 1`,
        [moisDebut, moisFin, f.id_societe, f.id_editeur, f.id_contrat, f.id_licence])
    : await tenantPool.query(
        `SELECT periode,
                sum(montant_commande)::float8     AS montant_commande,
                sum(montant_a_renouveler)::float8 AS montant_a_renouveler,
                sum(nb_commandes)::int            AS nb_commandes,
                sum(nb_a_renouveler)::int         AS nb_a_renouveler
           FROM precalcul_financier
          WHERE periode BETWEEN $1 AND $2
            AND ($3::uuid IS NULL OR id_societe = $3::uuid)
            AND ($4::uuid IS NULL OR id_editeur = $4::uuid)
          GROUP BY periode`,
        [moisDebut, moisFin, f.id_societe, f.id_editeur]);
  return { source: parLicenceOuContrat ? "commande" : "precalcul_financier",
           parPeriode: new Map(rows.map((r) => [r.periode, r])) };
}

const CLES_ENGAGE = ["montant_commande", "montant_a_renouveler", "nb_commandes", "nb_a_renouveler"];

// ---------------------------------------------------------------------------
// Routes de lecture agregee, declarees AVANT /budget/:id : sinon Express fait
// correspondre "engage", "synthese" ou "preremplissage" au parametre.
// ---------------------------------------------------------------------------

// Projection previsionnelle a partir de la maintenance en cours de la
// licence. Rien n'est ecrit : la ligne renvoyee est prete a etre POSTee.
// Base = periodes de maintenance_historique en cours a la date du jour (debut
// atteint, fin nulle ou a venir), licence non arretee ; cout lu comme un cout
// annuel. Exercice cible par defaut = exercice courant de la societe payeuse
// + 1 ; facteur = (1 + 3,5 %) ^ (cible - courant), jamais moins de 1.
router.get("/budget/preremplissage", async (req, res) => {
  try {
    const { id_licence, exercice } = req.query;
    if (!id_licence)
      return erreur(res, 5111, { status: 400, message: "La licence est obligatoire." });
    if (!UUID_RE.test(id_licence))
      return erreur(res, 5112, { status: 404, message: "Licence introuvable." });

    let cible = null;
    if (exercice !== undefined) {
      cible = Number(exercice);
      if (!Number.isInteger(cible) || cible < 1970 || cible > 2999)
        return erreur(res, 5124, { status: 400, message: "L'exercice demande est invalide." });
    }

    const { rows: lic } = await tenantPool.query(
      `SELECT l.id, l.label, l.quantite, l.type, l.id_produit,
              l.a_maintenance,
              l.date_arret_maintenance::text AS date_arret_maintenance,
              l.date_fin_maintenance::text   AS date_fin_maintenance,
              l.id_commande,   c.label          AS commande_label,
              c.id_contrat,    ct.label         AS contrat_label,
              ct.id_editeur,   e.raison_sociale AS editeur_label,
              c.id_societe,    s.raison_sociale AS societe_label,
              ${DEBUT_EXERCICE}::text AS debut_exercice_fiscal,
              exercice_fiscal_de(CURRENT_DATE, ${DEBUT_EXERCICE}) AS exercice_courant
         FROM licence l
         LEFT JOIN commande c  ON c.id  = l.id_commande
         LEFT JOIN contrat  ct ON ct.id = c.id_contrat
         LEFT JOIN editeur  e  ON e.id  = ct.id_editeur
         LEFT JOIN societe  s  ON s.id  = c.id_societe
         ${JOIN_TENANT}
        WHERE l.id = $1`, [id_licence]);
    if (!lic.length)
      return erreur(res, 5112, { status: 404, message: "Licence introuvable." });
    const [licence] = await resoudreProduits(lic);

    const exerciceCourant = licence.exercice_courant;
    const exerciceCible = cible ?? exerciceCourant + 1;
    const nbAnnees = Math.max(exerciceCible - exerciceCourant, 0);
    const facteur = (1 + TAUX_INFLATION) ** nbAnnees;

    const { rows: [bornes] } = await tenantPool.query(
      `SELECT exercice_fiscal_debut($1::int, $2::date)::text AS date_debut,
              exercice_fiscal_fin($1::int, $2::date)::text   AS date_fin`,
      [exerciceCible, licence.debut_exercice_fiscal]);

    // Une maintenance arretee (version figee) ne se projette pas : la base
    // est vide, quel que soit l'historique.
    const arretee = licence.date_arret_maintenance !== null;
    const { rows: base } = arretee ? { rows: [] } : await tenantPool.query(
      `SELECT h.id, h.date_debut::text AS date_debut, h.date_fin::text AS date_fin,
              h.cout::float8 AS cout,
              h.id_mainteneur, m.raison_sociale AS mainteneur_label,
              h.id_revendeur,  r.raison_sociale AS revendeur_label
         FROM maintenance_historique h
         LEFT JOIN mainteneur m ON m.id = h.id_mainteneur
         LEFT JOIN revendeur  r ON r.id = h.id_revendeur
        WHERE h.id_licence = $1
          AND h.date_debut <= CURRENT_DATE
          AND (h.date_fin IS NULL OR h.date_fin >= CURRENT_DATE)
        ORDER BY h.date_debut, h.created_at`, [id_licence]);

    const baseMontant = centime(base.reduce((t, h) => t + (h.cout ?? 0), 0));
    const nbCoutsInconnus = base.filter((h) => h.cout === null).length;
    const montantOpex = centime(baseMontant * facteur);

    // Lignes deja saisies sur l'exercice cible : le front les affiche pour
    // eviter un doublon de previsionnel.
    const { rows: existantes } = await tenantPool.query(
      `SELECT b.id, b.type,
              b.date_debut::text AS date_debut, b.date_fin::text AS date_fin,
              (COALESCE(b.montant_capex, 0) + COALESCE(b.montant_opex, 0))::float8 AS montant_total
         FROM budget b
        WHERE b.id_licence = $1
          AND exercice_fiscal_de(b.date_debut, $2::date) = $3::int
        ORDER BY b.type, b.created_at`,
      [id_licence, licence.debut_exercice_fiscal, exerciceCible]);

    const data = {
      id_licence: licence.id,
      licence_label: licence.label,
      licence_type: licence.type,
      licence_quantite: licence.quantite,
      id_produit: licence.id_produit,
      produit_label: licence.produit_label,
      produit_sku: licence.produit_sku,
      id_commande: licence.id_commande,   commande_label: licence.commande_label,
      id_contrat: licence.id_contrat,     contrat_label: licence.contrat_label,
      id_editeur: licence.id_editeur,     editeur_label: licence.editeur_label,
      id_societe: licence.id_societe,     societe_label: licence.societe_label,
      societe_indeterminee: licence.id_societe === null,
      debut_exercice_fiscal: licence.debut_exercice_fiscal,
      exercice_courant: exerciceCourant,
      exercice_cible: exerciceCible,
      nb_annees: nbAnnees,
      taux_inflation: TAUX_INFLATION * 100,
      facteur_inflation: Math.round(facteur * 1e6) / 1e6,
      maintenance_arretee: arretee,
      base,
      base_montant: baseMontant,
      nb_couts_inconnus: nbCoutsInconnus,
      ligne: {
        id_licence: licence.id,
        type: "previsionnel",
        montant_capex: null,
        quantite_capex: null,
        date_capex: null,
        montant_opex: montantOpex,
        quantite_opex: licence.quantite,
        date_debut: bornes.date_debut,
        date_fin: bornes.date_fin,
      },
      lignes_existantes: existantes,
    };

    // Un seul code par reponse : la projection vide prime sur la societe
    // indeterminee, qui prime sur le succes plein.
    const code = !base.length ? 5130 : (licence.id_societe === null ? 5131 : 5105);
    succes(res, code, data);
  } catch (err) {
    console.error("GET /budget/preremplissage error", err);
    erreur(res, 5199, { status: 500, message: "Erreur serveur" });
  }
});

// Engage, lu exclusivement dans les donnees reelles (commandes). Aucun
// previsionnel n'entre ici.
router.get("/budget/engage", async (req, res) => {
  try {
    const axes = lireFiltresAxes(req.query);
    if (axes.pivot) return erreurPivot(res, axes.pivot);
    const r = await resoudreBornes(req.query);
    if (r.pivot) return erreurPivot(res, r.pivot);
    const { bornes } = r;

    const moisDebut = bornes.date_debut.slice(0, 7);
    const moisFin = bornes.date_fin.slice(0, 7);
    const { source, parPeriode } = await lireEngage(moisDebut, moisFin, axes.filtres);

    // Tous les mois de la plage sont renvoyes, les mois sans commande a 0.
    const mois = moisEntre(moisDebut, moisFin).map((periode) => {
      const l = parPeriode.get(periode);
      const sortie = { periode, mois: Number(periode.slice(5)) };
      for (const c of CLES_ENGAGE) sortie[c] = l ? l[c] : 0;
      return sortie;
    });
    // Totaux derives des mois, jamais requetes separement.
    const totaux = {};
    for (const c of CLES_ENGAGE) totaux[c] = centime(mois.reduce((t, m) => t + m[c], 0));

    succes(res, 5106, {
      ...bornes,
      periode_debut: moisDebut,
      periode_fin: moisFin,
      filtres: axes.filtres,
      source,
      mois,
      totaux,
    });
  } catch (err) {
    console.error("GET /budget/engage error", err);
    erreur(res, 5199, { status: 500, message: "Erreur serveur" });
  }
});

// Synthese mensuelle previsionnel / alloue / engage sur une periode. CAPEX
// impute au mois de COALESCE(date_capex, date_debut), OPEX lisse a parts
// egales sur les mois de [date_debut, date_fin] de la ligne (hypothese v0.5).
// Sommes en numeric cote SQL, cast en float8 a la sortie seulement.
router.get("/budget/synthese", async (req, res) => {
  try {
    const axes = lireFiltresAxes(req.query);
    if (axes.pivot) return erreurPivot(res, axes.pivot);
    const r = await resoudreBornes(req.query);
    if (r.pivot) return erreurPivot(res, r.pivot);
    const { bornes } = r;
    const f = axes.filtres;

    const moisDebut = bornes.date_debut.slice(0, 7);
    const moisFin = bornes.date_fin.slice(0, 7);

    const { rows: budgetMois } = await tenantPool.query(
      `WITH mois AS (
         SELECT to_char(m, 'YYYY-MM') AS periode, m::date AS debut_mois
           FROM generate_series(date_trunc('month', $1::date), date_trunc('month', $2::date), interval '1 month') m
       ), lignes AS (
         SELECT b.type, b.montant_capex, b.montant_opex,
                date_trunc('month', COALESCE(b.date_capex, b.date_debut))::date AS mois_capex,
                date_trunc('month', b.date_debut)::date AS mois_debut,
                date_trunc('month', b.date_fin)::date   AS mois_fin,
                ((EXTRACT(YEAR FROM b.date_fin) - EXTRACT(YEAR FROM b.date_debut)) * 12
                  + EXTRACT(MONTH FROM b.date_fin) - EXTRACT(MONTH FROM b.date_debut) + 1)::int AS nb_mois
           FROM budget b
           JOIN licence       l  ON l.id  = b.id_licence
           LEFT JOIN commande c  ON c.id  = l.id_commande
           LEFT JOIN contrat  ct ON ct.id = c.id_contrat
          WHERE ($3::uuid IS NULL OR c.id_societe  = $3::uuid)
            AND ($4::uuid IS NULL OR ct.id_editeur = $4::uuid)
            AND ($5::uuid IS NULL OR c.id_contrat  = $5::uuid)
            AND ($6::uuid IS NULL OR b.id_licence  = $6::uuid)
       )
       SELECT m.periode,
              COALESCE(sum(l.montant_capex) FILTER (WHERE l.type = 'previsionnel' AND l.mois_capex = m.debut_mois), 0)::float8 AS previsionnel_capex,
              COALESCE(sum(l.montant_opex / l.nb_mois) FILTER (WHERE l.type = 'previsionnel' AND m.debut_mois BETWEEN l.mois_debut AND l.mois_fin), 0)::float8 AS previsionnel_opex,
              COALESCE(sum(l.montant_capex) FILTER (WHERE l.type = 'alloue' AND l.mois_capex = m.debut_mois), 0)::float8 AS alloue_capex,
              COALESCE(sum(l.montant_opex / l.nb_mois) FILTER (WHERE l.type = 'alloue' AND m.debut_mois BETWEEN l.mois_debut AND l.mois_fin), 0)::float8 AS alloue_opex
         FROM mois m
         LEFT JOIN lignes l ON l.mois_capex = m.debut_mois OR m.debut_mois BETWEEN l.mois_debut AND l.mois_fin
        GROUP BY m.periode
        ORDER BY m.periode`,
      [bornes.date_debut, bornes.date_fin, f.id_societe, f.id_editeur, f.id_contrat, f.id_licence]);

    // Nombre de lignes qui recoupent la periode, par type : le front sait ainsi
    // si une synthese a zero vient d'une absence de saisie ou de montants nuls.
    const { rows: nbLignes } = await tenantPool.query(
      `SELECT b.type, count(*)::int AS nb
         FROM budget b
         JOIN licence       l  ON l.id  = b.id_licence
         LEFT JOIN commande c  ON c.id  = l.id_commande
         LEFT JOIN contrat  ct ON ct.id = c.id_contrat
        WHERE b.date_debut <= $2::date AND b.date_fin >= $1::date
          AND ($3::uuid IS NULL OR c.id_societe  = $3::uuid)
          AND ($4::uuid IS NULL OR ct.id_editeur = $4::uuid)
          AND ($5::uuid IS NULL OR c.id_contrat  = $5::uuid)
          AND ($6::uuid IS NULL OR b.id_licence  = $6::uuid)
        GROUP BY b.type`,
      [bornes.date_debut, bornes.date_fin, f.id_societe, f.id_editeur, f.id_contrat, f.id_licence]);
    const nb_lignes = { previsionnel: 0, alloue: 0 };
    for (const n of nbLignes) nb_lignes[n.type] = n.nb;

    const { source, parPeriode } = await lireEngage(moisDebut, moisFin, f);
    const parMoisBudget = new Map(budgetMois.map((m) => [m.periode, m]));

    const mois = moisEntre(moisDebut, moisFin).map((periode) => {
      const b = parMoisBudget.get(periode);
      const e = parPeriode.get(periode);
      const previsionnel_capex = centime(b?.previsionnel_capex ?? 0);
      const previsionnel_opex = centime(b?.previsionnel_opex ?? 0);
      const alloue_capex = centime(b?.alloue_capex ?? 0);
      const alloue_opex = centime(b?.alloue_opex ?? 0);
      return {
        periode, mois: Number(periode.slice(5)),
        previsionnel_capex, previsionnel_opex,
        previsionnel: centime(previsionnel_capex + previsionnel_opex),
        alloue_capex, alloue_opex,
        alloue: centime(alloue_capex + alloue_opex),
        engage: e ? e.montant_commande : 0,
        nb_commandes: e ? e.nb_commandes : 0,
      };
    });

    // Totaux derives des mois : egaux a leur somme par construction. L'arrondi
    // au centime absorbe le residu binaire de l'addition flottante.
    const somme = (cle) => centime(mois.reduce((t, m) => t + m[cle], 0));
    const totaux = {
      previsionnel_capex: somme("previsionnel_capex"),
      previsionnel_opex: somme("previsionnel_opex"),
      previsionnel: somme("previsionnel"),
      alloue_capex: somme("alloue_capex"),
      alloue_opex: somme("alloue_opex"),
      alloue: somme("alloue"),
      engage: somme("engage"),
      nb_commandes: mois.reduce((t, m) => t + m.nb_commandes, 0),
    };
    totaux.ecart_previsionnel_alloue = centime(totaux.alloue - totaux.previsionnel);
    totaux.ecart_alloue_engage = centime(totaux.alloue - totaux.engage);
    // Taux en pourcentage, null sans alloue : un taux sur zero n'a pas de sens.
    totaux.taux_engagement = totaux.alloue > 0 ? centime((totaux.engage / totaux.alloue) * 100) : null;

    succes(res, 5107, {
      ...bornes,
      periode_debut: moisDebut,
      periode_fin: moisFin,
      filtres: f,
      source_engage: source,
      nb_lignes,
      mois,
      totaux,
    });
  } catch (err) {
    console.error("GET /budget/synthese error", err);
    erreur(res, 5199, { status: 500, message: "Erreur serveur" });
  }
});

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

// Filtres optionnels : id_licence, id_societe (payeuse deduite), id_editeur
// (editeur du contrat deduit), id_contrat, id_commande, type, exercice
// (exercice fiscal de la societe payeuse de chaque ligne, contenant
// date_debut), ou plage date_debut / date_fin (recouvrement).
router.get("/budget", async (req, res) => {
  try {
    const q = req.query;
    for (const cle of ["id_licence", "id_societe", "id_editeur", "id_contrat", "id_commande"]) {
      if (q[cle] && !UUID_RE.test(q[cle]))
        return erreur(res, 5123, { status: 400, message: `Identifiant de filtre invalide (${cle}).` });
    }
    if (q.type && !TYPES.includes(q.type))
      return erreur(res, 5113, { status: 400, message: "Le type doit etre previsionnel ou alloue." });

    let exercice = null;
    if (q.exercice !== undefined) {
      exercice = Number(q.exercice);
      if (!Number.isInteger(exercice) || exercice < 1970 || exercice > 2999)
        return erreur(res, 5124, { status: 400, message: "L'exercice demande est invalide." });
    }
    let plageDebut = null, plageFin = null;
    if (q.date_debut !== undefined || q.date_fin !== undefined) {
      if (!dateValide(q.date_debut || "") || !dateValide(q.date_fin || "") || q.date_fin < q.date_debut)
        return erreur(res, 5125, { status: 400, message: "La periode demandee est invalide." });
      plageDebut = q.date_debut;
      plageFin = q.date_fin;
    }

    // Filtres poses sur la projection (sous-requete) : l'exercice est une
    // colonne calculee, inutilisable dans le WHERE de la requete interne.
    const { rows } = await tenantPool.query(
      `SELECT * FROM (${SELECT_BUDGET}) x
        WHERE ($1::uuid IS NULL OR x.id_licence  = $1::uuid)
          AND ($2::uuid IS NULL OR x.id_societe  = $2::uuid)
          AND ($3::uuid IS NULL OR x.id_editeur  = $3::uuid)
          AND ($4::uuid IS NULL OR x.id_contrat  = $4::uuid)
          AND ($5::uuid IS NULL OR x.id_commande = $5::uuid)
          AND ($6::text IS NULL OR x.type        = $6::text)
          AND ($7::int  IS NULL OR x.exercice    = $7::int)
          AND ($8::date IS NULL OR (x.date_debut::date <= $9::date AND x.date_fin::date >= $8::date))
        ORDER BY x.date_debut DESC, x.societe_label NULLS LAST, x.licence_label, x.type`,
      [q.id_licence || null, q.id_societe || null, q.id_editeur || null, q.id_contrat || null,
       q.id_commande || null, q.type || null, exercice, plageDebut, plageFin]);

    succes(res, 5100, await resoudreProduits(rows));
  } catch (err) {
    console.error("GET /budget error", err);
    erreur(res, 5199, { status: 500, message: "Erreur serveur" });
  }
});

router.get("/budget/:id", async (req, res) => {
  const { id } = req.params;
  try {
    if (!UUID_RE.test(id)) return introuvable(res);
    const ligne = await lireLigne(id);
    if (!ligne) return introuvable(res);
    succes(res, 5101, ligne);
  } catch (err) {
    console.error("GET /budget/:id error", err);
    erreur(res, 5199, { status: 500, message: "Erreur serveur" });
  }
});

router.post("/budget", async (req, res) => {
  const corps = normaliserCorps(req.body);
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    const invalide = await validerBudget(client, corps);
    if (invalide) {
      await client.query("ROLLBACK");
      return erreurPivot(res, invalide);
    }

    const { rows: [creee] } = await client.query(
      `INSERT INTO budget (${CHAMPS.join(", ")})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      CHAMPS.map((ch) => corps[ch]));

    const apres = await lireBrute(client, creee.id);
    // Trace probante (code 5150) : l'acteur est req.user, dans la transaction.
    await auditer(client, req, { action: "BUDGET_CREE", entiteType: "budget", entiteId: creee.id, apres });
    await log(client, req, "CREATE", "budget", creee.id,
      `Creation d'une ligne budgetaire ${corps.type} sur la licence ${corps.id_licence}`, corps);
    await client.query("COMMIT");

    succes(res, 5102, await lireLigne(creee.id), { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /budget error", err);
    erreur(res, 5199, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.patch("/budget/:id", async (req, res) => {
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
      corps[champ] = Object.prototype.hasOwnProperty.call(req.body ?? {}, champ) ? patch[champ] : avant[champ];
    }

    const invalide = await validerBudget(client, corps);
    if (invalide) { await client.query("ROLLBACK"); return erreurPivot(res, invalide); }

    await client.query(
      `UPDATE budget
          SET ${CHAMPS.map((ch, i) => `${ch} = $${i + 1}`).join(", ")}
        WHERE id = $${CHAMPS.length + 1}`,
      [...CHAMPS.map((ch) => corps[ch]), id]);

    const apres = await lireBrute(client, id);
    const d = diff(avant, apres);
    // Trace probante (code 5151), diff avant/apres.
    await auditer(client, req, { action: "BUDGET_MODIFIE", entiteType: "budget", entiteId: id, avant: d.avant, apres: d.apres });
    await log(client, req, "UPDATE", "budget", id,
      `Modification de la ligne budgetaire ${corps.type} sur la licence ${corps.id_licence}`, patch);
    await client.query("COMMIT");

    succes(res, 5103, await lireLigne(id));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /budget/:id error", err);
    erreur(res, 5199, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// Aucune FK entrante sur budget : la suppression est physique et sans
// garde-fou de rattachement. L'acces est porte par supprimer_budget
// (routesPermissions.js, migrations 035 et 036).
router.delete("/budget/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    if (!UUID_RE.test(id)) { await client.query("ROLLBACK"); return introuvable(res); }
    const avant = await lireBrute(client, id, true);
    if (!avant) { await client.query("ROLLBACK"); return introuvable(res); }

    await client.query(`DELETE FROM budget WHERE id = $1`, [id]);
    // Trace probante (code 5152) : l'etat supprime est conserve en valeur_avant.
    await auditer(client, req, { action: "BUDGET_SUPPRIME", entiteType: "budget", entiteId: id, avant });
    await log(client, req, "DELETE", "budget", id,
      `Suppression de la ligne budgetaire ${avant.type} sur la licence ${avant.id_licence}`, null);
    await client.query("COMMIT");
    succes(res, 5104, null);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /budget/:id error", err);
    erreur(res, 5199, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

export default router;
