import express from "express";
import { tenantPool } from "../db.js";
import { succes, erreur } from "../utils/reponse.js";
import { ENTITES_VALIDABLES, lireStatutCourant } from "../utils/validationWorkflow.js";

const router = express.Router();

// Convention du projet : helper de journalisation local a chaque routeur.
// Celui-ci renseigne id_auteur, contrairement a ceux des routeurs de saisie :
// sur un traitement de validation, l'auteur est l'information centrale.
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
// illisible la ou l'entite est simplement introuvable.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Corps commun aux deux endpoints : seuls le statut cible et le motif changent.
//
// Aucun controle de profil ici, decision de sequencement de la #53 : tout
// utilisateur authentifie traite, y compris ses propres saisies. La story
// Droits viendra se brancher exactement a cet endroit, entre le chargement de
// l'entite et la lecture du statut courant.
async function traiter(req, res, statutCible, motif) {
  const { entite_type: entiteType, entite_id: entiteId } = req.params;

  // hasOwnProperty et non un acces direct : un entite_type valant "constructor"
  // resoudrait sinon une propriete du prototype.
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

    // Le nom de table vient du catalogue, jamais du parametre de route.
    const { rows: existant } = await client.query(
      `SELECT label FROM ${cible.table} WHERE id = $1`, [entiteId]);
    if (!existant.length) {
      await client.query("ROLLBACK");
      return erreur(res, 3311, { status: 404, message: cible.introuvable });
    }

    const courant = await lireStatutCourant(client, entiteType, entiteId, true);
    // Cas residuel apres la migration 020 : une entite creee par un chemin qui
    // ne soumet pas. Refus explicite plutot que creation implicite, un
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

    // Statut lu avant l'UPDATE plutot qu'en sous-requete : un referentiel
    // incomplet mettrait sinon id_statut a NULL sans bruit.
    const { rows: [statut] } = await client.query(
      `SELECT id, label FROM validation_status WHERE code = $1`, [statutCible]);
    if (!statut) {
      throw new Error(`validation_status : le code '${statutCible}' est absent du referentiel.`);
    }

    // message_refus = $3 vaut effacement du motif a la validation, motif nul.
    await client.query(
      `UPDATE workflow_validation
          SET id_statut = $1, id_traite_par = $2, message_refus = $3
        WHERE id = $4`,
      [statut.id, req.user?.id || null, motif, courant.id]);

    const label = existant[0].label;
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
  // Controle avant toute connexion : un refus sans motif est irrecevable quelle
  // que soit l'entite visee.
  if (!motif) {
    return erreur(res, 3314, { status: 400, message: "Le motif de refus est obligatoire." });
  }
  traiter(req, res, "refuse", motif);
});

export default router;
