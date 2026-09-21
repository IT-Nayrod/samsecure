// Preuves documentaires : saisie sous workflow de validation, dépôt et
// téléchargement du fichier justificatif stocké hors de l'arborescence servie.
// Unification de l'affichage (#215, ticket client du 16/09/2026) : la liste
// sert toutes les preuves, support de facture compris, chaque ligne portant son
// type documentaire (sept valeurs de type_preuve) et, pour un support de
// facture, id_facture et le statut de validation lu sur la facture (la preuve
// support n'a pas de demande propre depuis la #204). La distinction preuve /
// facture n'existe plus à l'écran ; la table facture et le circuit de dépôt
// combiné (factures.js) sont inchangés.

import express from "express";
import { tenantPool, commonPool } from "../db.js";
import { succes, erreur, erreurPivot, codeEntete } from "../utils/reponse.js";
import fs from "node:fs";
import path from "node:path";
import {
  PREUVES_DIR, TYPES_ADMIS, NOM_PHYSIQUE_RE,
  recevoirUnFichier, erreurReception, validerFichier, ecrireFichier, supprimerFichier,
} from "../utils/stockagePreuves.js";
import { COLONNES_STATUT, soumettre, purgerValidations } from "../utils/validationWorkflow.js";
import { dateIsoValide } from "../utils/dateIso.js";

const router = express.Router();

// Convention du projet : helper de journalisation local à chaque routeur.
// id_auteur est lu dans req.user (session JWT), comme le fait audit() : les
// quatre routeurs de saisie sont montés après authMiddleware, req.user est
// donc toujours renseigné. Jamais un id arbitraire : la FK vers utilisateur
// ferait avorter la transaction en cours.
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

// Garde-fou : un :id non UUID part sinon en Postgres et ressort en 500 illisible
// là où la preuve est simplement introuvable.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Empreinte SHA-256 : 64 caractères hexadécimaux, soit exactement la taille de
// la colonne VARCHAR(64). Sans ce contrôle, une saisie plus longue produirait
// une 22001 brute remontée en 500.
const SHA256_RE = /^[0-9a-f]{64}$/i;


// Statut de validation d'une preuve (#215) : celui de sa facture quand elle en
// est le support (objet unique, #204 : la facture porte la demande), sinon le
// sien. Même forme que jointureStatut (validationWorkflow.js), dont le LATERAL
// ne sait viser qu'un seul entite_type ; le type et l'identifiant visés se
// déduisent ici de fx (facture portant la preuve, jointure précédente). Un seul
// prédicat d'égalité sur (entite_type, entite_id) : idx_workflow_entite sert.
const JOINTURE_STATUT_PREUVE = `
  LEFT JOIN LATERAL (
    SELECT vs.code  AS statut_validation,
           vs.label AS statut_validation_label,
           CASE WHEN vs.code = 'refuse' THEN w.message_refus END AS message_refus
      FROM workflow_validation w
      LEFT JOIN validation_status vs ON vs.id = w.id_statut
     WHERE w.entite_type = CASE WHEN fx.id IS NULL THEN 'preuve' ELSE 'facture' END
       AND w.entite_id   = COALESCE(fx.id, p.id)
     ORDER BY w.created_at DESC, w.id DESC
     LIMIT 1
  ) wv ON true`;

// Projection identique en liste et en détail : garantit qu'aucun champ
// n'apparaisse dans un écran et pas dans l'autre.
// nb_factures est servi dès la liste, et non seulement sur le détail : c'est le
// compteur qui bloque la suppression, le front doit pouvoir griser l'action
// sans une requête par ligne.
// id_facture et facture_label (#215) : facture dont la preuve est le support,
// la première créée si le DDL en laissait plusieurs (cas que l'interface ne
// produit pas). Le front valide alors l'entité facture, jamais la preuve.
// Contrat de la commande (id_contrat_commande et ses libellés) : une preuve
// rattachée à une commande se situe aussi par le contrat de celle-ci, comme le
// faisait la ligne facture ; id_contrat reste le rattachement direct, seul
// modifiable.
const SELECT_PREUVE = `
  SELECT p.id, p.label,
         p.date_preuve::text AS date_preuve,
         p.id_type_preuve, tp.code AS type_code, tp.label AS type_label,
         p.id_contrat,     ct.label AS contrat_label, sct.raison_sociale AS contrat_societe_label,
         p.id_commande,    cm.label AS commande_label,
         cm.id_contrat AS id_contrat_commande, ctc.label AS contrat_commande_label,
         sctc.raison_sociale AS contrat_commande_societe_label,
         p.id_licence,     li.label AS licence_label,
         p.url_fichier, p.hash_sha256, p.nom_origine, p.created_at,
         fx.id AS id_facture, fx.label AS facture_label,
         (SELECT count(*) FROM facture f WHERE f.id_preuve = p.id)::int AS nb_factures,
         ${COLONNES_STATUT}
  FROM preuve p
  LEFT JOIN type_preuve tp ON tp.id = p.id_type_preuve
  LEFT JOIN contrat     ct ON ct.id = p.id_contrat
  LEFT JOIN societe     sct ON sct.id = ct.id_societe
  LEFT JOIN commande    cm ON cm.id = p.id_commande
  LEFT JOIN contrat     ctc ON ctc.id = cm.id_contrat
  LEFT JOIN societe     sctc ON sctc.id = ctc.id_societe
  LEFT JOIN licence     li ON li.id = p.id_licence
  LEFT JOIN LATERAL (
    SELECT f.id, f.label FROM facture f WHERE f.id_preuve = p.id
     ORDER BY f.created_at, f.id LIMIT 1
  ) fx ON true
  ${JOINTURE_STATUT_PREUVE}`;

// nom_origine en est volontairement absent : il n'est pas saisissable, seul
// le dépôt de la #49 le renseigne, en même temps que url_fichier et le hash.
// date_preuve (#214) : date métier du document, distincte de created_at (date
// de dépôt, posée par la base), facultative, commune à tous les types.
// Ordre identique aux $n de l'INSERT et de l'UPDATE.
const CHAMPS = [
  "label", "id_type_preuve", "id_contrat", "id_commande", "id_licence", "url_fichier", "hash_sha256",
  "date_preuve",
];

// Filtres de liste : premier usage de query params dans les CRUD du projet.
// Forme reprise de GET /commandes/agregats, validation UUID puis clause
// construite, pour garder une requête unique quel que soit le nombre de
// filtres actifs. Chaque filtre reçoit le numéro de son paramètre et rend sa
// clause.
// id_contrat (#215) : rattachée au contrat directement ou par l'une de ses
// commandes. Avant l'unification, la page assemblait les preuves libres du
// contrat (rattachement direct) et les factures de ses commandes : la règle
// dépendait de la nature de la ligne, ce que le client a demandé de faire
// disparaître. Une seule règle pour toutes les lignes, quel que soit le type.
// Période de la date de la preuve (#214) : date_preuve_min et date_preuve_max,
// bornes incluses, indépendantes l'une de l'autre. Une preuve sans date ne
// répond à aucune borne : filtrer par période, c'est chercher des documents
// datés.
const FILTRES = {
  id_type_preuve: { type: "uuid", clause: (n) => `p.id_type_preuve = $${n}::uuid` },
  id_contrat: { type: "uuid", clause: (n) => `(p.id_contrat = $${n}::uuid OR cm.id_contrat = $${n}::uuid)` },
  id_commande: { type: "uuid", clause: (n) => `p.id_commande = $${n}::uuid` },
  id_licence: { type: "uuid", clause: (n) => `p.id_licence = $${n}::uuid` },
  date_preuve_min: { type: "date", clause: (n) => `p.date_preuve >= $${n}::date` },
  date_preuve_max: { type: "date", clause: (n) => `p.date_preuve <= $${n}::date` },
};

function construireFiltres(query) {
  const clauses = [];
  const params = [];
  for (const [param, { type, clause }] of Object.entries(FILTRES)) {
    const valeur = query[param];
    if (valeur === undefined || valeur === "") continue;
    const valide = type === "date" ? dateIsoValide(valeur) : UUID_RE.test(valeur);
    if (!valide) return { erreur: `Valeur de filtre invalide pour ${param}.` };
    params.push(valeur);
    clauses.push(clause(params.length));
  }
  return { clause: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

// Objet unique facture = preuve (#204), retour de recette du 16/09 (#99) : une
// preuve de type Facture naît du dépôt de facture (POST /factures/depot), qui
// crée le fichier, la preuve support et la facture en une transaction. Créée
// ou requalifiée par ce routeur, elle n'aurait ni facture ni fichier garanti :
// la détection des manques la verrait « sans facture » et la liste la
// montrerait sans validation de facture. Le refus est lisible (3234) plutôt
// qu'un objet à moitié né ; une preuve déjà portée par une facture reste
// modifiable (PATCH du libellé, de la date).
async function typeEstFacture(client, idTypePreuve) {
  if (!idTypePreuve || !UUID_RE.test(idTypePreuve)) return false;
  const { rowCount } = await client.query(
    `SELECT 1 FROM type_preuve WHERE id = $1 AND code = 'facture'`, [idTypePreuve]);
  return rowCount > 0;
}

async function porteeParFacture(client, idPreuve) {
  if (!idPreuve) return false;
  const { rowCount } = await client.query(`SELECT 1 FROM facture WHERE id_preuve = $1`, [idPreuve]);
  return rowCount > 0;
}

// Vérifie l'existence d'une référence. Évite qu'un UUID inconnu remonte en
// 23503 brute transformée en 500 illisible. Un id absent est valide : c'est
// la validation de présence qui tranche, pas celle d'existence.
async function existe(client, table, id) {
  if (!id) return true;
  // Une référence malformée ne doit pas partir en Postgres : elle ressortirait
  // en 22P02 brute remontée en 500, là où la référence est simplement
  // introuvable. Même doctrine que le garde-fou UUID sur les :id de route.
  if (!UUID_RE.test(id)) return false;
  const { rowCount } = await client.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
  return rowCount > 0;
}

// Objet unique facture = preuve (#204) : la preuve support d'une facture ne
// porte aucune demande de validation propre. Toute modification de cette
// preuve (métadonnées, remplacement du fichier) resoumet la facture qui la
// référence, jamais la preuve. Une preuve libre se resoumet elle-même.
async function resoumettre(client, idPreuve, idUtilisateur) {
  const { rows } = await client.query(`SELECT id FROM facture WHERE id_preuve = $1`, [idPreuve]);
  if (!rows.length) return soumettre(client, "preuve", idPreuve, idUtilisateur);
  for (const facture of rows) await soumettre(client, "facture", facture.id, idUtilisateur);
}

// Un select vide envoie "" et non null. Sans cette normalisation, "" part sur
// une colonne UUID et produit une 22P02 brute remontée en 500.
function normaliserCorps(body = {}) {
  const vide = (v) => (v === "" || v === undefined ? null : v);
  return {
    label: body.label ?? "",
    id_type_preuve: vide(body.id_type_preuve),
    id_contrat: vide(body.id_contrat),
    id_commande: vide(body.id_commande),
    id_licence: vide(body.id_licence),
    url_fichier: vide(body.url_fichier),
    hash_sha256: vide(body.hash_sha256),
    date_preuve: vide(body.date_preuve),
  };
}

// idPreuve : preuve existante (PATCH), pour tolérer le type Facture sur une
// preuve déjà portée par sa facture.
async function validerPreuve(client, body, { idPreuve = null } = {}) {
  const { label, id_type_preuve, id_contrat, id_commande, id_licence, url_fichier, hash_sha256, date_preuve } = body;

  if (!label || !label.trim())
    return { status: 400, code: 3211, error: "Le libelle est obligatoire." };
  if (!id_type_preuve)
    return { status: 400, code: 3212, error: "Le type de preuve est obligatoire." };
  if (!(await existe(client, "type_preuve", id_type_preuve)))
    return { status: 400, code: 3213, error: "Type de preuve introuvable." };
  if (await typeEstFacture(client, id_type_preuve) && !(await porteeParFacture(client, idPreuve)))
    return { status: 400, code: 3234, error: "Le type Facture n'est pas accepté ici : une facture se dépose avec son fichier par le dépôt de facture (POST /factures/depot)." };
  // Règle métier de la #48, étendue par la #208 : une preuve sans rattachement
  // est orpheline, elle ne serait atteignable ni par un contrat, ni par une
  // commande, ni par une licence. Le DDL laisse les trois colonnes nullables,
  // c'est l'API qui porte la contrainte. Le formulaire propose un seul
  // rattachement à la fois ; l'API reste tolérante au cumul, les preuves
  // antérieures à la #208 pouvant porter contrat et commande ensemble.
  if (!id_contrat && !id_commande && !id_licence)
    return { status: 400, code: 3214, error: "Une preuve doit être rattachée à un contrat, à une commande ou à une licence." };
  if (!(await existe(client, "contrat", id_contrat)))
    return { status: 400, code: 3215, error: "Contrat introuvable." };
  if (!(await existe(client, "commande", id_commande)))
    return { status: 400, code: 3216, error: "Commande introuvable." };
  if (!(await existe(client, "licence", id_licence)))
    return { status: 400, code: 3228, error: "Licence introuvable." };
  // url_fichier est NOT NULL en base (002_tenant_schema.sql:351). Décision du
  // 11/08 : on ne migre pas, le champ est donc obligatoire dès la #48. En #49
  // il sera renseigné par le module de dépôt et non plus par le client, sans
  // changement de ce contrat d'API.
  // [ARBITRAGE D27] en attente : aucun contrôle de format n'est appliqué ici,
  // ni exigence d'un chemin de stockage, ni acceptation explicite d'une URL
  // http/https de GED. La chaîne est stockée telle quelle. La règle viendra se
  // brancher à cet endroit précis, code 3231 réservé.
  if (!url_fichier || !url_fichier.trim())
    return { status: 400, code: 3217, error: "Le chemin du fichier est obligatoire." };
  // Le hash reste facultatif : le rendre obligatoire préjugerait de D27, qui
  // prévoit justement un hash NULL pour un lien externe. Seul son format est
  // vérifié quand il est fourni.
  if (hash_sha256 && !SHA256_RE.test(hash_sha256))
    return { status: 400, code: 3218, error: "L'empreinte SHA-256 doit comporter 64 caracteres hexadecimaux." };
  // Date de la preuve (#214) : facultative pour tous les types, les preuves
  // antérieures restent sans date. Format et calendrier contrôlés ici, sinon
  // 22007 ou 22008 brute remontée en 500.
  if (date_preuve !== null && date_preuve !== undefined && !dateIsoValide(date_preuve))
    return { status: 400, code: 3233, error: "La date de la preuve est invalide (format attendu AAAA-MM-JJ)." };
  return null;
}

router.get("/preuves", async (req, res) => {
  try {
    const filtres = construireFiltres(req.query);
    if (filtres.erreur) return erreur(res, 3219, { status: 400, message: filtres.erreur });

    // Toutes les preuves, support de facture compris (#215) : la ligne d'une
    // preuve support porte id_facture et le statut de sa facture, l'écran ne
    // distingue plus les deux natures. GET /factures reste servi tel quel.
    const { rows } = await tenantPool.query(
      `${SELECT_PREUVE} ${filtres.clause} ORDER BY p.created_at DESC, p.label`,
      filtres.params
    );
    succes(res, 3200, rows);
  } catch (err) {
    console.error("GET /preuves error", err);
    erreur(res, 3299, { status: 500, message: "Erreur serveur" });
  }
});

// ---------------------------------------------------------------------------
// Définition des champs par type de preuve (#204, dépôt unifié, 060 et 061)
// ---------------------------------------------------------------------------
// La modale de preuve rend ses champs additionnels depuis cette réponse et
// n'en connaît aucun en dur. Définition SamSecure en Commune
// (default_type_preuve_champ), surcharge par espace client en Tenant
// (type_preuve_champ, même structure) : une ligne Tenant de même
// (code_type_preuve, nom) remplace la ligne Commune, une ligne Tenant sans
// équivalent s'ajoute, une ligne inactive masque le champ. Les deux bases ne
// se joignent pas : la fusion se fait ici, comme pour les seuils de dashboard.
// Seuls les champs actifs sont servis, triés par type, ordre puis nom. Le
// rapprochement se fait sur le code du type, que GET /types-preuve sert avec
// chaque type.
// Déclarée avant /preuves/:id par convention ; le chemin ne peut de toute
// façon pas être capté par referentiels.js, dont /types-preuve est exact.
const COLONNES_CHAMP = "code_type_preuve, nom, libelle, type_champ, obligatoire, ordre, actif";

router.get("/types-preuve/champs", async (req, res) => {
  try {
    const [{ rows: defauts }, { rows: surcharges }] = await Promise.all([
      commonPool.query(`SELECT ${COLONNES_CHAMP} FROM default_type_preuve_champ`),
      tenantPool.query(`SELECT ${COLONNES_CHAMP} FROM type_preuve_champ`),
    ]);
    const cle = (c) => `${c.code_type_preuve}/${c.nom}`;
    const fusion = new Map();
    for (const d of defauts) fusion.set(cle(d), { ...d, origine: "commune" });
    for (const s of surcharges) fusion.set(cle(s), { ...s, origine: "tenant" });
    const champs = [...fusion.values()]
      .filter((c) => c.actif)
      .sort((a, b) =>
        a.code_type_preuve.localeCompare(b.code_type_preuve)
        || a.ordre - b.ordre
        || a.nom.localeCompare(b.nom));
    succes(res, 3229, champs);
  } catch (err) {
    console.error("GET /types-preuve/champs error", err);
    erreur(res, 3299, { status: 500, message: "Erreur serveur" });
  }
});

router.get("/preuves/:id", async (req, res) => {
  const { id } = req.params;
  try {
    if (!UUID_RE.test(id)) return erreur(res, 3210, { status: 404, message: "Preuve introuvable." });

    const { rows } = await tenantPool.query(`${SELECT_PREUVE} WHERE p.id = $1`, [id]);
    if (!rows.length) return erreur(res, 3210, { status: 404, message: "Preuve introuvable." });

    succes(res, 3201, rows[0]);
  } catch (err) {
    console.error("GET /preuves/:id error", err);
    erreur(res, 3299, { status: 500, message: "Erreur serveur" });
  }
});

router.post("/preuves", async (req, res) => {
  const corps = normaliserCorps(req.body);
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    const invalide = await validerPreuve(client, corps);
    if (invalide) {
      await client.query("ROLLBACK");
      return erreurPivot(res, invalide);
    }

    const label = corps.label.trim();
    const { rows: [creee] } = await client.query(
      `INSERT INTO preuve (${CHAMPS.join(", ")})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [label, corps.id_type_preuve, corps.id_contrat, corps.id_commande, corps.id_licence,
       corps.url_fichier, corps.hash_sha256, corps.date_preuve]
    );

    // Toute saisie part en attente de validation, dans la même transaction que
    // l'écriture métier.
    await soumettre(client, "preuve", creee.id, req.user?.id);

    await log(client, req, "CREATE", "preuve", creee.id, `Creation de la preuve "${label}"`, corps);
    await client.query("COMMIT");

    const { rows } = await tenantPool.query(`${SELECT_PREUVE} WHERE p.id = $1`, [creee.id]);
    succes(res, 3202, rows[0], { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /preuves error", err);
    erreur(res, 3299, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.patch("/preuves/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    if (!UUID_RE.test(id)) {
      await client.query("ROLLBACK");
      return erreur(res, 3210, { status: 404, message: "Preuve introuvable." });
    }

    const { rows: existant } = await client.query(
      `SELECT label, id_type_preuve, id_contrat, id_commande, id_licence, url_fichier, hash_sha256,
              date_preuve::text AS date_preuve
       FROM preuve WHERE id = $1`, [id]);
    if (!existant.length) {
      await client.query("ROLLBACK");
      return erreur(res, 3210, { status: 404, message: "Preuve introuvable." });
    }

    // Fusion avant validation : un PATCH partiel ne doit pas échouer sur un
    // champ obligatoire qui n'a simplement pas été transmis. hasOwnProperty
    // distingue le champ absent du champ volontairement mis à null.
    const patch = normaliserCorps(req.body);
    const corps = { ...existant[0] };
    for (const champ of CHAMPS) {
      if (Object.prototype.hasOwnProperty.call(req.body, champ)) corps[champ] = patch[champ];
    }

    const invalide = await validerPreuve(client, corps, { idPreuve: id });
    if (invalide) {
      await client.query("ROLLBACK");
      return erreurPivot(res, invalide);
    }

    // Pas de updated_at : la table preuve n'en porte pas (002_tenant_schema.sql:344).
    const label = corps.label.trim();
    await client.query(
      `UPDATE preuve
          SET label = $1, id_type_preuve = $2, id_contrat = $3, id_commande = $4,
              id_licence = $5, url_fichier = $6, hash_sha256 = $7, date_preuve = $8
        WHERE id = $9`,
      [label, corps.id_type_preuve, corps.id_contrat, corps.id_commande, corps.id_licence,
       corps.url_fichier, corps.hash_sha256, corps.date_preuve, id]
    );

    // Une modification est une saisie : retour en attente, motif de refus effacé.
    await resoumettre(client, id, req.user?.id);

    await log(client, req, "UPDATE", "preuve", id, `Modification de la preuve "${label}"`, patch);
    await client.query("COMMIT");

    const { rows } = await tenantPool.query(`${SELECT_PREUVE} WHERE p.id = $1`, [id]);
    succes(res, 3203, rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /preuves/:id error", err);
    erreur(res, 3299, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.delete("/preuves/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    if (!UUID_RE.test(id)) {
      await client.query("ROLLBACK");
      return erreur(res, 3210, { status: 404, message: "Preuve introuvable." });
    }

    const { rows: existant } = await client.query(`SELECT label, url_fichier FROM preuve WHERE id = $1`, [id]);
    if (!existant.length) {
      await client.query("ROLLBACK");
      return erreur(res, 3210, { status: 404, message: "Preuve introuvable." });
    }

    // Seule FK entrante de preuve dans le DDL v4 : facture.id_preuve. Supprimer
    // la preuve laisserait la facture sans justificatif, ce que la #50 compte
    // précisément détecter comme un manque.
    const { rows: [liens] } = await client.query(
      `SELECT count(*)::int AS factures FROM facture WHERE id_preuve = $1`, [id]);

    if (liens.factures) {
      await client.query("ROLLBACK");
      return erreur(res, 3230, {
        status: 409,
        message: `Suppression impossible : cette preuve est rattachee a ${liens.factures} facture(s).`,
        details: liens,
      });
    }

    // workflow_validation.entite_id est polymorphe et sans FK : nettoyage
    // applicatif, dans la même transaction que la suppression.
    await purgerValidations(client, "preuve", id);
    await client.query(`DELETE FROM preuve WHERE id = $1`, [id]);
    await log(client, req, "DELETE", "preuve", id, `Suppression de la preuve "${existant[0].label}"`, null);
    await client.query("COMMIT");

    // Le fichier physique ne survit pas à sa preuve : sans cela le stockage
    // accumulerait des orphelins qu'aucune ligne ne référence plus. Supprimé
    // après le COMMIT, pour ne pas le perdre si la transaction échouait.
    await supprimerFichier(existant[0].url_fichier);
    succes(res, 3204, null);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /preuves/:id error", err);
    erreur(res, 3299, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// Dépôt et téléchargement du fichier de preuve (#49)
// Les règles de stockage vivent dans utils/stockagePreuves.js, partagées avec
// le dépôt combiné de /api/factures/depot : une liste d'extensions qui
// divergerait entre les deux points d'entrée ouvrirait un contournement.
// ---------------------------------------------------------------------------

const recevoirFichier = recevoirUnFichier("fichier");

// Trace probante, distincte du journal fonctionnel : audit_log porte
// l'utilisateur, l'adresse IP et les valeurs avant et après, que
// journal_ecriture ne modélise pas.
// Contrairement à log(), cette fonction n'avale pas ses erreurs : une trace
// probante manquante doit faire échouer le dépôt, pas passer inaperçue.
async function audit(client, req, action, entiteId, avant, apres) {
  await client.query(
    `INSERT INTO audit_log (id_utilisateur, action, entite_type, entite_id,
                            valeur_avant, valeur_apres, ip_address)
     VALUES ($1, $2, 'preuve', $3, $4, $5, $6)`,
    [req.user?.id || null, action, entiteId,
     avant ? JSON.stringify(avant) : null,
     apres ? JSON.stringify(apres) : null,
     (req.ip || "").slice(0, 45)]
  );
}

async function deposerFichier(req, res) {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return erreur(res, 3210, { status: 404, message: "Preuve introuvable." });
  if (!req.file) return erreur(res, 3220, { status: 400, message: "Aucun fichier n'a ete transmis." });

  const invalideFichier = validerFichier(req.file);
  if (invalideFichier) return erreurPivot(res, invalideFichier);

  const client = await tenantPool.connect();
  let ecrit = null;
  try {
    await client.query("BEGIN");

    const { rows: existant } = await client.query(
      `SELECT label, url_fichier, hash_sha256, nom_origine FROM preuve WHERE id = $1`, [id]);
    if (!existant.length) {
      await client.query("ROLLBACK");
      return erreur(res, 3210, { status: 404, message: "Preuve introuvable." });
    }
    const avant = existant[0];
    const remplacement = NOM_PHYSIQUE_RE.test(avant.url_fichier || "");

    ecrit = await ecrireFichier(req.file);

    await client.query(
      `UPDATE preuve SET url_fichier = $1, hash_sha256 = $2, nom_origine = $3 WHERE id = $4`,
      [ecrit.nomPhysique, ecrit.hash, ecrit.nomOrigine, id]);

    // Remplacer le justificatif d'une preuve validée est une modification :
    // elle repasse en attente. C'est le cas où le contrôle a le plus de valeur.
    // Support d'une facture : c'est la facture qui repasse en attente (#204).
    await resoumettre(client, id, req.user?.id);

    await audit(client, req, remplacement ? "REMPLACEMENT_FICHIER" : "DEPOT_FICHIER", id,
      remplacement
        ? { url_fichier: avant.url_fichier, hash_sha256: avant.hash_sha256, nom_origine: avant.nom_origine }
        : null,
      { url_fichier: ecrit.nomPhysique, hash_sha256: ecrit.hash, nom_origine: ecrit.nomOrigine, taille: req.file.size });

    await log(client, req, "UPDATE", "preuve", id,
      `${remplacement ? "Remplacement" : "Depot"} du fichier de la preuve "${avant.label}"`,
      { nom_origine: ecrit.nomOrigine, hash_sha256: ecrit.hash });

    await client.query("COMMIT");

    // L'ancien fichier n'est supprimé qu'après le COMMIT : le supprimer avant
    // le ferait perdre si la transaction échouait.
    if (remplacement && avant.url_fichier !== ecrit.nomPhysique) await supprimerFichier(avant.url_fichier);

    const { rows } = await tenantPool.query(`${SELECT_PREUVE} WHERE p.id = $1`, [id]);
    succes(res, 3205, rows[0], { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    // Le fichier écrit avant l'échec ne doit pas rester orphelin sur le disque.
    if (ecrit) await supprimerFichier(ecrit.nomPhysique);
    console.error("POST /preuves/:id/fichier error", err);
    erreur(res, 3299, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
}

// multer est appelé en fonction et non en middleware : c'est le seul moyen de
// traduire ses erreurs, notamment le dépassement de taille, dans le format de
// réponse du projet plutôt que de les laisser filer au handler global.
router.post("/preuves/:id/fichier", (req, res) => {
  recevoirFichier(req, res, (err) => {
    if (err) {
      const connue = erreurReception(err);
      if (connue) return erreurPivot(res, connue);
      console.error("POST /preuves/:id/fichier multipart error", err);
      return erreur(res, 3220, { status: 400, message: "Aucun fichier n'a ete transmis." });
    }
    deposerFichier(req, res);
  });
});

router.get("/preuves/:id/fichier", async (req, res) => {
  const { id } = req.params;
  try {
    if (!UUID_RE.test(id)) return erreur(res, 3210, { status: 404, message: "Preuve introuvable." });

    const { rows } = await tenantPool.query(
      `SELECT url_fichier, nom_origine FROM preuve WHERE id = $1`, [id]);
    if (!rows.length) return erreur(res, 3210, { status: 404, message: "Preuve introuvable." });

    const { url_fichier, nom_origine } = rows[0];

    // [ARBITRAGE D27] en attente : si le lien GED externe est retenu, c'est ici
    // qu'une url_fichier en http/https donnera lieu à une redirection plutôt
    // qu'à un accès disque, code 3232 réservé au pré-catalogue. Dans l'attente,
    // seul un fichier déposé par cette tâche est servi.
    if (!NOM_PHYSIQUE_RE.test(url_fichier || ""))
      return erreur(res, 3224, { status: 404, message: "Aucun fichier n'a ete depose pour cette preuve." });

    // Garde-fou de traversée de chemin : url_fichier a pu être saisi librement
    // par le POST /preuves de la #48. Le motif ci-dessus l'interdit déjà, la
    // résolution le vérifie une seconde fois avant tout accès disque.
    const racine = path.resolve(PREUVES_DIR);
    const chemin = path.resolve(racine, url_fichier);
    if (!chemin.startsWith(racine + path.sep))
      return erreur(res, 3226, { status: 404, message: "Aucun fichier n'a ete depose pour cette preuve." });

    if (!fs.existsSync(chemin)) {
      console.error(`[stockage] fichier absent du disque pour la preuve ${id} : ${url_fichier}`);
      return erreur(res, 3225, { status: 404, message: "Le fichier est introuvable dans le stockage." });
    }

    const extension = path.extname(url_fichier).toLowerCase();
    const nom = nom_origine || `preuve${extension}`;
    // Repli ASCII pour les clients anciens, filename* en RFC 5987 pour que les
    // accents du nom d'origine survivent sur les clients modernes.
    const nomAscii = nom.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");

    res.setHeader("Content-Type", TYPES_ADMIS[extension] || "application/octet-stream");
    // Disposition inline : le PDF s'ouvre dans le lecteur natif du navigateur,
    // aperçu et bouton de téléchargement compris, sans visionneuse à écrire.
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${nomAscii}"; filename*=UTF-8''${encodeURIComponent(nom)}`
    );
    // sendFile avec root plutôt qu'un chemin absolu : send() applique sa
    // politique dotfiles à l'intégralité d'un chemin absolu et refuserait un
    // répertoire de stockage situé sous un dossier commençant par un point.
    // Avec root, seule la partie relative est examinée, et send vérifie lui
    // même qu'elle ne sort pas de la racine : le garde-fou de traversée est
    // ainsi double. Le callback est indispensable, l'erreur d'envoi étant
    // asynchrone elle échapperait au try/catch et finirait au handler global.
    codeEntete(res, 3206).sendFile(url_fichier, { root: racine }, (err) => {
      if (!err) return;
      if (res.headersSent) return console.error("GET /preuves/:id/fichier interrompu", err.message);
      console.error("GET /preuves/:id/fichier envoi impossible", err);
      erreur(res, 3225, { status: 404, message: "Le fichier est introuvable dans le stockage." });
    });
  } catch (err) {
    console.error("GET /preuves/:id/fichier error", err);
    erreur(res, 3299, { status: 500, message: "Erreur serveur" });
  }
});

export default router;
