// Workflow de validation des saisies (#53).
//
// Les tables contrat, commande, facture et preuve ne portent aucune colonne de
// statut et ne doivent pas en porter : le statut d'une entité est la dernière
// entrée de workflow_validation qui la désigne. Chaque saisie, création comme
// modification, insère une entrée en_attente ; le traitement met à jour cette
// entrée. L'historique des soumissions en découle sans table supplémentaire.

import { apresTraitementAffectation } from "./revalidation.js";

// Catalogue des entités soumises au workflow. entite_id est polymorphe et ne
// porte aucune FK SQL : ce catalogue est la seule barrière entre un
// entite_type reçu en paramètre de route et un nom de table réel. Il ne doit
// jamais être étendu à partir d'une entrée utilisateur.
// apresTraitement (optionnel) : hook exécuté par validation.js dans la
// transaction du traitement, après la mise à jour de l'entrée. C'est par lui
// que le module 3 branche son cycle de revalidation sur le circuit unique,
// sans second workflow ni seconde file (#106).
// colonneLabel (optionnel) : colonne portant le libellé lisible de l'entité,
// pour les messages de journal. Les cinq entités de saisie nomment la leur
// label, les tiers du module 1 la nomment raison_sociale.
export const ENTITES_VALIDABLES = {
  contrat:        { table: "contrat",        introuvable: "Contrat introuvable." },
  commande:       { table: "commande",       introuvable: "Commande introuvable." },
  facture:        { table: "facture",        introuvable: "Facture introuvable." },
  preuve:         { table: "preuve",         introuvable: "Preuve introuvable." },
  affectation:    { table: "affectation",    introuvable: "Affectation introuvable.",
                    apresTraitement: apresTraitementAffectation },
  editeur:        { table: "editeur",        introuvable: "Editeur introuvable.",
                    colonneLabel: "raison_sociale" },
  produit_client: { table: "produit_client", introuvable: "Logiciel introuvable." },
};

// Comme table, la valeur sort du catalogue et jamais d'un paramètre de route :
// son interpolation dans une requête est sûre ici, et nulle part ailleurs.
export function colonneLabel(cible) {
  return cible.colonneLabel || "label";
}

// Fragment à coller dans les projections de liste et de détail. Le LATERAL sert
// la dernière entrée seule, sans sous-requête par colonne, et s'appuie sur
// idx_workflow_entite.
// message_refus n'est exposé que sur un refus : la validation efface le motif,
// ce CASE immunise en plus la lecture contre une donnée résiduelle.
// entiteType et alias sont des constantes du code, jamais des valeurs de
// requête : l'interpolation est sûre ici et nulle part ailleurs.
export function jointureStatut(entiteType, alias) {
  return `
  LEFT JOIN LATERAL (
    SELECT vs.code  AS statut_validation,
           vs.label AS statut_validation_label,
           CASE WHEN vs.code = 'refuse' THEN w.message_refus END AS message_refus
      FROM workflow_validation w
      LEFT JOIN validation_status vs ON vs.id = w.id_statut
     WHERE w.entite_type = '${entiteType}' AND w.entite_id = ${alias}.id
     ORDER BY w.created_at DESC, w.id DESC
     LIMIT 1
  ) wv ON true`;
}

// Colonnes à ajouter à la liste du SELECT, en pendant de jointureStatut.
export const COLONNES_STATUT =
  "wv.statut_validation, wv.statut_validation_label, wv.message_refus";

// Une saisie, création ou modification. Appelée dans la transaction de
// l'écriture métier : une entité créée sans son entrée de validation serait
// invisible du workflow, donc jamais validable.
export async function soumettre(client, entiteType, entiteId, idUtilisateur) {
  const { rowCount } = await client.query(
    `INSERT INTO workflow_validation (entite_type, entite_id, id_soumis_par, id_statut)
     SELECT $1, $2, $3, vs.id FROM validation_status vs WHERE vs.code = 'en_attente'`,
    [entiteType, entiteId, idUtilisateur || null]
  );
  // Zéro ligne insérée signifie référentiel non seedé : échouer bruyamment
  // vaut mieux qu'une entité sans statut.
  if (!rowCount) {
    throw new Error("validation_status : le code 'en_attente' est absent du referentiel.");
  }
}

// Dernière entrée de l'entité, ou null. verrou pose un FOR UPDATE sur la ligne
// pour que deux traitements concurrents ne traitent pas deux fois la même
// saisie. Il ne protège pas d'une soumission concurrente, cas où le traitement
// porte sur l'entrée qui existait au début de la transaction.
export async function lireStatutCourant(client, entiteType, entiteId, verrou = false) {
  const { rows } = await client.query(
    `SELECT w.id, w.message_refus, vs.code AS statut, vs.label AS statut_label
       FROM workflow_validation w
       LEFT JOIN validation_status vs ON vs.id = w.id_statut
      WHERE w.entite_type = $1 AND w.entite_id = $2
      ORDER BY w.created_at DESC, w.id DESC
      LIMIT 1
      ${verrou ? "FOR UPDATE OF w" : ""}`,
    [entiteType, entiteId]
  );
  return rows[0] || null;
}

// Nettoyage applicatif à la suppression de l'entité. entite_id ne porte aucune
// FK : sans cet appel, les entrées survivraient à leur entité.
export async function purgerValidations(client, entiteType, entiteId) {
  await client.query(
    `DELETE FROM workflow_validation WHERE entite_type = $1 AND entite_id = $2`,
    [entiteType, entiteId]
  );
}
