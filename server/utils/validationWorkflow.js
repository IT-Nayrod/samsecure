// Workflow de validation des saisies (#53).
//
// Les tables contrat, commande, facture et preuve ne portent aucune colonne de
// statut et ne doivent pas en porter : le statut d'une entite est la derniere
// entree de workflow_validation qui la designe. Chaque saisie, creation comme
// modification, insere une entree en_attente ; le traitement met a jour cette
// entree. L'historique des soumissions en decoule sans table supplementaire.

import { apresTraitementAffectation } from "./revalidation.js";

// Catalogue des entites soumises au workflow. entite_id est polymorphe et ne
// porte aucune FK SQL : ce catalogue est la seule barriere entre un
// entite_type recu en parametre de route et un nom de table reel. Il ne doit
// jamais etre etendu a partir d'une entree utilisateur.
// apresTraitement (optionnel) : hook execute par validation.js dans la
// transaction du traitement, apres la mise a jour de l'entree. C'est par lui
// que le module 3 branche son cycle de revalidation sur le circuit unique,
// sans second workflow ni seconde file (#106).
export const ENTITES_VALIDABLES = {
  contrat:     { table: "contrat",     introuvable: "Contrat introuvable." },
  commande:    { table: "commande",    introuvable: "Commande introuvable." },
  facture:     { table: "facture",     introuvable: "Facture introuvable." },
  preuve:      { table: "preuve",      introuvable: "Preuve introuvable." },
  affectation: { table: "affectation", introuvable: "Affectation introuvable.",
                 apresTraitement: apresTraitementAffectation },
};

// Fragment a coller dans les projections de liste et de detail. Le LATERAL sert
// la derniere entree seule, sans sous-requete par colonne, et s'appuie sur
// idx_workflow_entite.
// message_refus n'est expose que sur un refus : la validation efface le motif,
// ce CASE immunise en plus la lecture contre une donnee residuelle.
// entiteType et alias sont des constantes du code, jamais des valeurs de
// requete : l'interpolation est sure ici et nulle part ailleurs.
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

// Colonnes a ajouter a la liste du SELECT, en pendant de jointureStatut.
export const COLONNES_STATUT =
  "wv.statut_validation, wv.statut_validation_label, wv.message_refus";

// Une saisie, creation ou modification. Appelee dans la transaction de
// l'ecriture metier : une entite creee sans son entree de validation serait
// invisible du workflow, donc jamais validable.
export async function soumettre(client, entiteType, entiteId, idUtilisateur) {
  const { rowCount } = await client.query(
    `INSERT INTO workflow_validation (entite_type, entite_id, id_soumis_par, id_statut)
     SELECT $1, $2, $3, vs.id FROM validation_status vs WHERE vs.code = 'en_attente'`,
    [entiteType, entiteId, idUtilisateur || null]
  );
  // Zero ligne inseree signifie referentiel non seede : echouer bruyamment
  // vaut mieux qu'une entite sans statut.
  if (!rowCount) {
    throw new Error("validation_status : le code 'en_attente' est absent du referentiel.");
  }
}

// Derniere entree de l'entite, ou null. verrou pose un FOR UPDATE sur la ligne
// pour que deux traitements concurrents ne traitent pas deux fois la meme
// saisie. Il ne protege pas d'une soumission concurrente, cas ou le traitement
// porte sur l'entree qui existait au debut de la transaction.
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

// Nettoyage applicatif a la suppression de l'entite. entite_id ne porte aucune
// FK : sans cet appel, les entrees survivraient a leur entite.
export async function purgerValidations(client, entiteType, entiteId) {
  await client.query(
    `DELETE FROM workflow_validation WHERE entite_type = $1 AND entite_id = $2`,
    [entiteType, entiteId]
  );
}
