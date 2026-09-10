// Traitement du workflow de validation : valider ou refuser la dernière saisie
// d'une entité du catalogue ENTITES_VALIDABLES, avec le hook propre à chaque entité.

import express from "express";
import { tenantPool } from "../db.js";
import { succes, erreur } from "../utils/reponse.js";
import { ENTITES_VALIDABLES, lireStatutCourant, colonneLabel } from "../utils/validationWorkflow.js";
import { notifierTraitement } from "../utils/notifications/moteur.js";

const router = express.Router();

// Convention du projet : helper de journalisation local à chaque routeur.
// Celui-ci reçoit id_auteur en paramètre ; les routeurs de saisie le lisent
// dans req.user (aligne le 24/08, #68). Sur un traitement de validation,
// l'auteur est l'information centrale.
async function log(client, action, entite_type, entite_id, description, id_auteur, payload) {
  try {
    await client.query(
      `INSERT INTO journal_ecriture (action, entite_type, entite_id, description, id_auteur, payload)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [action, entite_type, entite_id || null, description, id_auteur || null,
       payload ? JSON.stringify(payload) : null]
    );
  } catch (e) {
    console.error("[journal] log failed:", e.message);
  }
}

// Garde-fou : un :entite_id non UUID part sinon en Postgres et ressort en 500
// illisible là où l'entité est simplement introuvable.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Corps commun aux deux endpoints : seuls le statut cible et le motif changent.
//
// Aucun contrôle de profil ici, décision de séquencement de la #53 : tout
// utilisateur authentifié traite, y compris ses propres saisies. La story
// Droits viendra se brancher exactement à cet endroit, entre le chargement de
// l'entité et la lecture du statut courant.
async function traiter(req, res, statutCible, motif) {
  const { entite_type: entiteType, entite_id: entiteId } = req.params;

  // hasOwnProperty et non un accès direct : un entite_type valant "constructor"
  // résoudrait sinon une propriété du prototype.
  const cible = Object.prototype.hasOwnProperty.call(ENTITES_VALIDABLES, entiteType)
    ? ENTITES_VALIDABLES[entiteType]
    : null;
  if (!cible) {
    return erreur(res, 3310, { status: 404, message: "Type d'entite inconnu du workflow de validation." });
  }
  if (!UUID_RE.test(entiteId)) return erreur(res, 3311, { status: 404, message: cible.introuvable });

  const client = await tenantPool.connect();
  try {
    await client.query("BEGIN");

    // Le nom de table et celui de la colonne de libellé viennent du catalogue,
    // jamais du paramètre de route. L'alias AS label garde la suite du
    // traitement ignorante du nom réel : les tiers du module 1 nomment leur
    // libellé raison_sociale, les entités de saisie le nomment label.
    const { rows: existant } = await client.query(
      `SELECT ${colonneLabel(cible)} AS label FROM ${cible.table} WHERE id = $1`, [entiteId]);
    if (!existant.length) {
      await client.query("ROLLBACK");
      return erreur(res, 3311, { status: 404, message: cible.introuvable });
    }

    const courant = await lireStatutCourant(client, entiteType, entiteId, true);
    // Cas résiduel après la migration 020 : une entité créée par un chemin qui
    // ne soumet pas. Refus explicite plutôt que création implicite, un
    // traitement ne doit pas fabriquer la demande qu'il traite.
    if (!courant) {
      await client.query("ROLLBACK");
      return erreur(res, 3312, { status: 409, message: "Cette saisie ne porte aucune demande de validation." });
    }
    if (courant.statut !== "en_attente") {
      await client.query("ROLLBACK");
      // Le statut courant est joint (details) pour resynchroniser le front sans second appel.
      return erreur(res, 3313, {
        status: 409,
        message: `Seule une saisie en attente peut etre traitee. Statut courant : ${courant.statut_label || courant.statut}.`,
        details: { statut_validation: courant.statut },
      });
    }

    // Statut lu avant l'UPDATE plutôt qu'en sous-requête : un référentiel
    // incomplet mettrait sinon id_statut à NULL sans bruit.
    const { rows: [statut] } = await client.query(
      `SELECT id, label FROM validation_status WHERE code = $1`, [statutCible]);
    if (!statut) {
      throw new Error(`validation_status : le code '${statutCible}' est absent du referentiel.`);
    }

    // message_refus = $3 vaut effacement du motif à la validation, motif nul.
    await client.query(
      `UPDATE workflow_validation
          SET id_statut = $1, id_traite_par = $2, message_refus = $3
        WHERE id = $4`,
      [statut.id, req.user?.id || null, motif, courant.id]);

    // Hook propre à l'entité (revalidation des affectations, #106) : même
    // transaction, un échec annule le traitement avec elle.
    if (cible.apresTraitement) {
      await cible.apresTraitement(client, req, entiteId, statutCible, motif);
    }

    const label = existant[0].label;

    // Notification saisie_traitee (#121) a l'auteur de la soumission, meme
    // transaction (SAVEPOINT interne), jamais bloquante ; courrier immediat
    // sur un refus, recapitulatif sur une validation.
    await notifierTraitement(client, {
      entiteType, entiteId, label, statut: statutCible, motif,
      idWorkflow: courant.id, idTraitePar: req.user?.id || null,
    });

    await log(client,
      statutCible === "valide" ? "VALIDATION" : "REFUS",
      entiteType, entiteId,
      statutCible === "valide"
        ? `Validation de la saisie "${label}"`
        : `Refus de la saisie "${label}"`,
      req.user?.id,
      motif ? { message_refus: motif } : null);

    await client.query("COMMIT");

    succes(res, statutCible === "valide" ? 3300 : 3301, {
      entite_type: entiteType,
      entite_id: entiteId,
      statut_validation: statutCible,
      statut_validation_label: statut.label,
      message_refus: motif,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`POST /validation/${entiteType}/${entiteId} error`, err);
    erreur(res, 3399, { status: 500, message: "Erreur serveur" });
  } finally {
    client.release();
  }
}

router.post("/validation/:entite_type/:entite_id/valider", (req, res) => {
  traiter(req, res, "valide", null);
});

router.post("/validation/:entite_type/:entite_id/refuser", (req, res) => {
  const brut = req.body?.message_refus;
  const motif = typeof brut === "string" ? brut.trim() : "";
  // Contrôle avant toute connexion : un refus sans motif est irrecevable quelle
  // que soit l'entité visée.
  if (!motif) {
    return erreur(res, 3314, { status: 400, message: "Le motif de refus est obligatoire." });
  }
  traiter(req, res, "refuse", motif);
});

export default router;
