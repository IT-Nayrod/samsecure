import express from "express";
import { tenantPool } from "../db.js";
import { succes, erreur, erreurPivot } from "../utils/reponse.js";
import {
  jointureStatut, COLONNES_STATUT, soumettre, purgerValidations,
} from "../utils/validationWorkflow.js";

const router = express.Router();

// Convention du projet : helper de journalisation local a chaque routeur.
// id_auteur est lu dans req.user (session JWT), comme le fait audit() : les
// quatre routeurs de saisie sont montes apres authMiddleware, req.user est
// donc toujours renseigne. Jamais un id arbitraire : la FK vers utilisateur
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

// Statut d'echeance : source unique de verite, jamais recalcule cote front.
// Ordre volontaire : perpetuel prime (pas de date_fin), puis expire prime sur
// a_renouveler (un contrat echu n'est pas "a renouveler").
const STATUT_ECHEANCE = `
  CASE
    WHEN c.date_fin IS NULL                              THEN 'perpetuel'
    WHEN c.date_fin < CURRENT_DATE                       THEN 'expire'
    WHEN c.a_renouveler                                  THEN 'a_renouveler'
    WHEN c.date_fin <= CURRENT_DATE + INTERVAL '90 days' THEN 'a_renouveler'
    ELSE 'actif'
  END AS statut_echeance`;

// Projection identique en liste et en detail : garantit qu'aucun champ
// n'apparaisse dans un ecran et pas dans l'autre.
// Garde-fou : un :id non UUID part sinon en Postgres et ressort en 500 illisible
// la ou le contrat est simplement introuvable.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Projection identique en liste et en detail : garantit qu'aucun champ
// n'apparaisse dans un ecran et pas dans l'autre.
const SELECT_CONTRAT = `
  SELECT c.id, c.label,
         c.id_type_contrat, tc.code AS type_code, tc.label AS type_label,
         c.id_editeur,   e.raison_sociale AS editeur_label,
         c.id_societe,   s.raison_sociale AS societe_label,
         c.id_revendeur, r.raison_sociale AS revendeur_label,
         c.id_contrat_parent, p.label AS parent_label, ps.raison_sociale AS parent_societe_label,
         c.date_debut::text AS date_debut, c.date_fin::text AS date_fin,
          c.a_renouveler, c.duree_resiliation,
         c.created_at, c.updated_at,
         ${STATUT_ECHEANCE},
         CASE WHEN c.date_fin IS NULL THEN NULL
              ELSE (c.date_fin - CURRENT_DATE) END AS jours_restants,
         ${COLONNES_STATUT}
  FROM contrat c
  LEFT JOIN type_contrat tc ON tc.id = c.id_type_contrat
  LEFT JOIN editeur      e  ON e.id  = c.id_editeur
  LEFT JOIN societe      s  ON s.id  = c.id_societe
  LEFT JOIN revendeur    r  ON r.id  = c.id_revendeur
  LEFT JOIN contrat      p  ON p.id  = c.id_contrat_parent
  LEFT JOIN societe      ps ON ps.id = p.id_societe
  ${jointureStatut("contrat", "c")}`;

// Colonnes metier ecrivables, dans l'ordre des parametres d'INSERT et d'UPDATE.
const CHAMPS = [
  "label", "id_type_contrat", "id_editeur", "id_societe", "id_revendeur",
  "id_contrat_parent", "date_debut", "date_fin", "a_renouveler", "duree_resiliation",
];

// Un <select> vide et un <input type="date"> vide envoient "" et non null.
// Sans cette normalisation, "" part sur une colonne UUID ou DATE et produit une
// 22P02 brute remontee en 500.
function normaliserCorps(body = {}) {
  const vide = (v) => (v === "" || v === undefined ? null : v);
  return {
    label: body.label ?? "",
    id_type_contrat: vide(body.id_type_contrat),
    id_editeur: vide(body.id_editeur),
    id_societe: vide(body.id_societe),
    id_revendeur: vide(body.id_revendeur),
    id_contrat_parent: vide(body.id_contrat_parent),
    date_debut: vide(body.date_debut),
    date_fin: vide(body.date_fin),
    a_renouveler: body.a_renouveler === true,
    duree_resiliation: vide(body.duree_resiliation) === null ? null : Number(body.duree_resiliation),
  };
}

// Verifie l'existence d'une reference. Evite qu'un UUID inconnu remonte en
// 23503 brute transformee en 500 illisible.
async function existe(client, table, id) {
  if (!id) return true;
  const { rowCount } = await client.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
  return rowCount > 0;
}

async function validerContrat(client, body) {
  const { label, id_type_contrat, id_editeur, id_societe, id_revendeur, date_debut, date_fin } = body;

  if (!label || !label.trim())
    return { status: 400, code: 3011, error: "Le libelle est obligatoire." };
  if (!id_type_contrat)
    return { status: 400, code: 3012, error: "Le type de contrat est obligatoire." };
  // Obligatoires depuis le retour de Samuel (#95). Pas de NOT NULL en base : un
  // contrat existant qui en manque reste consultable, il n'est refuse qu'a sa
  // prochaine modification puisque le PATCH valide l'enregistrement fusionne.
  if (!id_editeur)
    return { status: 400, code: 3022, error: "L'editeur est obligatoire." };
  if (!id_societe)
    return { status: 400, code: 3023, error: "La societe signataire est obligatoire." };
  if (!id_revendeur)
    return { status: 400, code: 3024, error: "Le revendeur signataire est obligatoire." };
  if (!date_debut)
    return { status: 400, code: 3025, error: "La date de debut est obligatoire." };
  // Doublon volontaire de ck_contrat_dates : la contrainte base produirait une
  // 23514 en 500, on veut un 400 lisible.
  if (date_debut && date_fin && date_debut > date_fin)
    return { status: 400, code: 3013, error: "La date de debut doit preceder la date de fin." };
  if (!(await existe(client, "type_contrat", id_type_contrat)))
    return { status: 400, code: 3014, error: "Type de contrat introuvable." };
  if (!(await existe(client, "editeur", id_editeur)))
    return { status: 400, code: 3015, error: "Editeur introuvable." };
  if (!(await existe(client, "societe", id_societe)))
    return { status: 400, code: 3016, error: "Societe signataire introuvable." };
  if (!(await existe(client, "revendeur", id_revendeur)))
    return { status: 400, code: 3017, error: "Revendeur signataire introuvable." };
  return null;
}

// Rattachement : le parent est accepte quel que soit son type. Seul le cycle
// est bloquant. Un parent non cadre est trace dans anomalie_qualite sans
// empecher l'operation (decision du 10/08).
// Retourne { erreur } bloquant, { anomalie } a inserer, ou {}.
async function verifierParent(client, idParent, idContrat) {
  if (!idParent) return {};

  if (idContrat && idParent === idContrat) {
    return { erreur: { status: 409, code: 3019, error: "Un contrat ne peut pas etre son propre parent." } };
  }

  const { rows } = await client.query(
    `SELECT c.label, tc.code,
            c.date_debut::text AS date_debut, c.date_fin::text AS date_fin
     FROM contrat c LEFT JOIN type_contrat tc ON tc.id = c.id_type_contrat
     WHERE c.id = $1`, [idParent]);

  if (!rows.length) {
    return { erreur: { status: 400, code: 3018, error: "Contrat parent introuvable." } };
  }

  // Cycle : on remonte la chaine des parents depuis le parent vise. Si l'on
  // retombe sur le contrat modifie, le rattachement fermerait une boucle.
  // En creation (idContrat null), le controle est sans objet.
  if (idContrat) {
    const { rows: cycle } = await client.query(
      `WITH RECURSIVE chaine AS (
         SELECT id, id_contrat_parent FROM contrat WHERE id = $1
         UNION ALL
         SELECT c.id, c.id_contrat_parent
         FROM contrat c JOIN chaine ch ON c.id = ch.id_contrat_parent
       )
       SELECT 1 FROM chaine WHERE id = $2 LIMIT 1`,
      [idParent, idContrat]);

    if (cycle.length) {
      return { erreur: { status: 409, code: 3019,
        error: "Ce rattachement creerait un cycle dans la hierarchie des contrats." } };
    }
  }

  // Test sur le code, jamais sur le label : celui-ci est personnalisable
  // (copy-on-write sur type_contrat).
  const parent = { label: rows[0].label, date_debut: rows[0].date_debut, date_fin: rows[0].date_fin };
  if (rows[0].code !== "cadre") return { anomalie: { parentLabel: rows[0].label }, parent };
  return { parent };
}

// Plage du parent : un enfant qui en sort n'est jamais refuse, il est trace dans
// anomalie_qualite sous un type propre, distinct de l'incoherence de type cadre
// pour que les deux signalements coexistent et se resolvent independamment.
function horsPlageParent(corps, parent) {
  if (!parent) return false;
  const debutAvant = parent.date_debut && corps.date_debut && corps.date_debut < parent.date_debut;
  const finApres = parent.date_fin && (!corps.date_fin || corps.date_fin > parent.date_fin);
  return !!(debutAvant || finApres);
}

async function signalerHorsPlageParent(client, idContrat, labelContrat, labelParent) {
  await client.query(
    `INSERT INTO anomalie_qualite (entite_type, entite_id, type_anomalie, gravite, description)
     SELECT 'contrat', $1, 'hors_plage_parent', 'attention', $2
     WHERE NOT EXISTS (
       SELECT 1 FROM anomalie_qualite
       WHERE entite_type = 'contrat' AND entite_id = $1
         AND type_anomalie = 'hors_plage_parent' AND resolu = false
     )`,
    [idContrat, `Contrat "${labelContrat}" hors de la periode de son contrat parent "${labelParent}"`]
  );
}

async function resoudreHorsPlageParent(client, idContrat) {
  await client.query(
    `UPDATE anomalie_qualite SET resolu = true
     WHERE entite_type = 'contrat' AND entite_id = $1
       AND type_anomalie = 'hors_plage_parent' AND resolu = false`,
    [idContrat]
  );
}

// Premiere ecriture applicative dans anomalie_qualite : la table existe depuis
// la migration 002 mais n'a jamais servi. Le vocabulaire pose ici fait
// convention pour les futurs producteurs d'anomalies.
// Transactionnelle : le critere de validation exige que la ligne existe apres
// l'operation, contrairement a log() qui avale ses erreurs.
async function signalerParentNonCadre(client, idContrat, labelContrat, labelParent) {
  // code_retour: 3021
  await client.query(
    `INSERT INTO anomalie_qualite (entite_type, entite_id, type_anomalie, gravite, description)
     SELECT 'contrat', $1, 'incoherence', 'attention', $2
     WHERE NOT EXISTS (
       SELECT 1 FROM anomalie_qualite
       WHERE entite_type = 'contrat' AND entite_id = $1
         AND type_anomalie = 'incoherence' AND resolu = false
     )`,
    [idContrat, `Contrat "${labelContrat}" rattache a un parent non cadre "${labelParent}"`]
  );
}

// Symetrique : quand le contrat est rattache a un cadre ou detache, l'anomalie
// existante n'a plus lieu d'etre.
async function resoudreAnomalieParent(client, idContrat) {
  await client.query(
    `UPDATE anomalie_qualite SET resolu = true
     WHERE entite_type = 'contrat' AND entite_id = $1
       AND type_anomalie = 'incoherence' AND resolu = false`,
    [idContrat]
  );
}
router.get("/contrats", async (req, res) => {
  try {
    const { rows } = await tenantPool.query(`${SELECT_CONTRAT} ORDER BY c.label`);
    succes(res, 3000, rows);
  } catch (err) {
    console.error("GET /contrats error", err);
    erreur(res, 3099, { status: 500, message: "Erreur serveur" });
  }
});

router.get("/contrats/:id", async (req, res) => {
  const { id } = req.params;
  try {
    if (!UUID_RE.test(id)) return erreur(res, 3010, { status: 404, message: "Contrat introuvable." });

    const { rows } = await tenantPool.query(`${SELECT_CONTRAT} WHERE c.id = $1`, [id]);
    if (!rows.length) return erreur(res, 3010, { status: 404, message: "Contrat introuvable." });

    // Memes compteurs que le garde-fou de suppression : la fiche detail affiche
    // le nombre reel de rattachements sans dependre des modules non branches.
    const { rows: [liens] } = await tenantPool.query(
      `SELECT (SELECT count(*) FROM commande WHERE id_contrat = $1)::int        AS nb_commandes,
              (SELECT count(*) FROM preuve   WHERE id_contrat = $1)::int        AS nb_preuves,
              (SELECT count(*) FROM contrat  WHERE id_contrat_parent = $1)::int AS nb_sous_contrats`,
      [id]);

    succes(res, 3001, { ...rows[0], ...liens });
  } catch (err) {
    console.error("GET /contrats/:id error", err);
    erreur(res, 3099, { status: 500, message: "Erreur serveur" });
  }
});

router.post("/contrats", async (req, res) => {
  const corps = normaliserCorps(req.body);
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    const invalide = await validerContrat(client, corps);
    if (invalide) {
      await client.query("ROLLBACK");
      return erreurPivot(res, invalide);
    }

    const parent = await verifierParent(client, corps.id_contrat_parent, null);
    if (parent.erreur) {
      await client.query("ROLLBACK");
      return erreurPivot(res, parent.erreur);
    }

    const label = corps.label.trim();
    const { rows: [cree] } = await client.query(
      `INSERT INTO contrat (${CHAMPS.join(", ")})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [label, corps.id_type_contrat, corps.id_editeur, corps.id_societe, corps.id_revendeur,
       corps.id_contrat_parent, corps.date_debut, corps.date_fin, corps.a_renouveler,
       corps.duree_resiliation]
    );

    if (parent.anomalie) {
      await signalerParentNonCadre(client, cree.id, label, parent.anomalie.parentLabel);
    }
    if (horsPlageParent(corps, parent.parent)) {
      await signalerHorsPlageParent(client, cree.id, label, parent.parent.label);
    }

    // Toute saisie part en attente de validation, dans la meme transaction que
    // l'ecriture metier : un contrat cree sans son entree de workflow serait
    // invisible du controle, donc jamais validable.
    await soumettre(client, "contrat", cree.id, req.user?.id);

    await log(client, req, "CREATE", "contrat", cree.id, `Creation du contrat "${label}"`, corps);

    const { rows } = await client.query(`${SELECT_CONTRAT} WHERE c.id = $1`, [cree.id]);
    await client.query("COMMIT");

    succes(res, 3002, rows[0], { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /contrats error", err);
    erreur(res, 3099, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.patch("/contrats/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    if (!UUID_RE.test(id)) {
      await client.query("ROLLBACK");
      return erreur(res, 3010, { status: 404, message: "Contrat introuvable." });
    }

    // Dates lues en texte : validerContrat compare des chaines ISO, un objet
    // Date de pg fausserait la comparaison date_debut > date_fin.
    const { rows: existant } = await client.query(
      `SELECT label, id_type_contrat, id_editeur, id_societe, id_revendeur, id_contrat_parent,
              date_debut::text AS date_debut, date_fin::text AS date_fin,
              a_renouveler, duree_resiliation
       FROM contrat WHERE id = $1`, [id]);
    if (!existant.length) {
      await client.query("ROLLBACK");
      return erreur(res, 3010, { status: 404, message: "Contrat introuvable." });
    }

    // Fusion avant validation : un PATCH partiel ne doit pas echouer sur un
    // champ obligatoire qui n'a simplement pas ete transmis.
    const patch = normaliserCorps(req.body);
    const corps = { ...existant[0] };
    for (const champ of CHAMPS) {
      if (Object.prototype.hasOwnProperty.call(req.body, champ)) corps[champ] = patch[champ];
    }

    const invalide = await validerContrat(client, corps);
    if (invalide) {
      await client.query("ROLLBACK");
      return erreurPivot(res, invalide);
    }

    const parent = await verifierParent(client, corps.id_contrat_parent, id);
    if (parent.erreur) {
      await client.query("ROLLBACK");
      return erreurPivot(res, parent.erreur);
    }

    const label = corps.label.trim();
    await client.query(
      `UPDATE contrat
          SET label = $1, id_type_contrat = $2, id_editeur = $3, id_societe = $4,
              id_revendeur = $5, id_contrat_parent = $6, date_debut = $7, date_fin = $8,
              a_renouveler = $9, duree_resiliation = $10, updated_at = now()
        WHERE id = $11`,
      [label, corps.id_type_contrat, corps.id_editeur, corps.id_societe, corps.id_revendeur,
       corps.id_contrat_parent, corps.date_debut, corps.date_fin, corps.a_renouveler,
       corps.duree_resiliation, id]
    );

    // Rattachement a un cadre ou detachement : l'anomalie eventuelle n'a plus lieu d'etre.
    if (parent.anomalie) await signalerParentNonCadre(client, id, label, parent.anomalie.parentLabel);
    else await resoudreAnomalieParent(client, id);
    if (horsPlageParent(corps, parent.parent)) await signalerHorsPlageParent(client, id, label, parent.parent.label);
    else await resoudreHorsPlageParent(client, id);

    // Une modification est une saisie : un contrat valide qui change repasse en
    // attente, sans comparaison avant/apres. Decision de la #53.
    await soumettre(client, "contrat", id, req.user?.id);

    await log(client, req, "UPDATE", "contrat", id, `Modification du contrat "${label}"`, patch);

    const { rows } = await client.query(`${SELECT_CONTRAT} WHERE c.id = $1`, [id]);
    await client.query("COMMIT");

    succes(res, 3003, rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /contrats/:id error", err);
    erreur(res, 3099, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

router.delete("/contrats/:id", async (req, res) => {
  const { id } = req.params;
  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    const { rows: existant } = await client.query(`SELECT label FROM contrat WHERE id = $1`, [id]);
    if (!existant.length) {
      await client.query("ROLLBACK");
      return erreur(res, 3010, { status: 404, message: "Contrat introuvable." });
    }

    // Les 3 FK entrantes du DDL v4. licence.id_contrat a ete supprimee par la
    // migration 014 : les licences sont protegees transitivement, la
    // suppression d'une commande controlant deja licence.id_commande.
    const { rows: [liens] } = await client.query(
      `SELECT (SELECT count(*) FROM commande WHERE id_contrat = $1)        AS commandes,
              (SELECT count(*) FROM preuve   WHERE id_contrat = $1)        AS preuves,
              (SELECT count(*) FROM contrat  WHERE id_contrat_parent = $1) AS sous_contrats`,
      [id]);

    const bloquants = [];
    if (+liens.commandes)     bloquants.push(`${liens.commandes} commande(s)`);
    if (+liens.preuves)       bloquants.push(`${liens.preuves} preuve(s)`);
    if (+liens.sous_contrats) bloquants.push(`${liens.sous_contrats} sous-contrat(s)`);

    if (bloquants.length) {
      await client.query("ROLLBACK");
      return erreur(res, 3020, {
        status: 409,
        message: `Suppression impossible : ce contrat porte ${bloquants.join(", ")}.`,
        details: liens,
      });
    }

    await client.query(`DELETE FROM anomalie_qualite WHERE entite_type = 'contrat' AND entite_id = $1`, [id]);
    // workflow_validation.entite_id est polymorphe et sans FK : le nettoyage est
    // applicatif, dans la meme transaction que la suppression.
    await purgerValidations(client, "contrat", id);
    await client.query(`DELETE FROM contrat WHERE id = $1`, [id]);
    await log(client, req, "DELETE", "contrat", id, `Suppression du contrat "${existant[0].label}"`, null);
    await client.query("COMMIT");
    succes(res, 3004, null);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /contrats/:id error", err);
    erreur(res, 3099, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
});

export default router;