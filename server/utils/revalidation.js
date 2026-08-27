// Cycle de revalidation des affectations (#106, M3-B).
//
// Une affectation validee doit etre reconfirmee periodiquement : l'echeance
// est calculee A LA VALIDATION selon delai_revalidation de la societe (30 jours
// par defaut) et inscrite dans la table revalidation. Le statut du cycle
// (a_jour, a_revalider, depasse) n'est jamais stocke comme verite : il est
// evalue a la lecture par rapport a CURRENT_DATE, cf. jointureRevalidation().
//
// Ce module ne connait pas le workflow de validation : c'est validation.js,
// via le hook apresTraitement du catalogue ENTITES_VALIDABLES, qui l'appelle
// quand une affectation est validee. Le circuit de validation reste unique.

import { auditer } from "./audit.js";

export const DELAI_REVALIDATION_DEFAUT = 30;

// Fenetre d'alerte avant l'echeance : en dessous, le cycle passe a_revalider
// et l'affectation entre dans la file de travail du Manager DSI. Valeur
// reprise de la vue operationnelle mockee (v0.5).
export const SEUIL_ALERTE_JOURS = 15;

// Fragment a coller dans les projections de liste et de detail, en pendant de
// jointureStatut() du workflow. Sert la derniere ligne revalidation seule et
// s'appuie sur idx_revalidation_affectation. alias est une constante du code.
export function jointureRevalidation(alias) {
  return `
  LEFT JOIN LATERAL (
    SELECT r.date_derniere_validation, r.date_prochaine_revalidation
      FROM revalidation r
     WHERE r.id_affectation = ${alias}.id
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT 1
  ) rv ON true`;
}

// Colonnes calculees a la lecture. Le cycle n'est expose que sur une
// affectation dont la derniere entree du workflow est valide : une saisie
// resoumise (en_attente) ou refusee ne porte plus d'echeance opposable.
// statut_validation est reecrit : valide + echeance depassee = a_revalider.
// C'est la seule reecriture, et elle n'est jamais persistee.
export const COLONNES_REVALIDATION = `
  CASE WHEN wv.statut_validation = 'valide'
        AND rv.date_prochaine_revalidation < CURRENT_DATE
       THEN 'a_revalider' ELSE wv.statut_validation END AS statut_validation,
  CASE WHEN wv.statut_validation = 'valide'
        AND rv.date_prochaine_revalidation < CURRENT_DATE
       THEN (SELECT label FROM validation_status WHERE code = 'a_revalider')
       ELSE wv.statut_validation_label END AS statut_validation_label,
  wv.message_refus,
  CASE WHEN wv.statut_validation = 'valide' THEN rv.date_derniere_validation::text END
       AS date_derniere_validation,
  CASE WHEN wv.statut_validation = 'valide' THEN rv.date_prochaine_revalidation::text END
       AS date_prochaine_revalidation,
  CASE WHEN wv.statut_validation = 'valide' AND rv.date_prochaine_revalidation IS NOT NULL
       THEN (rv.date_prochaine_revalidation - CURRENT_DATE) END AS jours_restants,
  CASE
    WHEN wv.statut_validation <> 'valide' OR rv.date_prochaine_revalidation IS NULL THEN NULL
    WHEN rv.date_prochaine_revalidation < CURRENT_DATE THEN 'depasse'
    WHEN rv.date_prochaine_revalidation <= CURRENT_DATE + ${SEUIL_ALERTE_JOURS} THEN 'a_revalider'
    ELSE 'a_jour'
  END AS statut_revalidation`;

// Delai applicable a une affectation : celui de sa societe, sinon le defaut.
export async function delaiRevalidation(client, idAffectation) {
  const { rows } = await client.query(
    `SELECT s.delai_revalidation
       FROM affectation a
       LEFT JOIN societe s ON s.id = a.id_societe
      WHERE a.id = $1`,
    [idAffectation]
  );
  return rows[0]?.delai_revalidation || DELAI_REVALIDATION_DEFAUT;
}

// Ouvre un nouveau cycle : nouvelle ligne revalidation datee du jour, echeance
// recopiee sur affectation.date_revalidation. Appelee dans la transaction de
// la validation (hook) et de l'action "revalider". Renvoie les dates ecrites.
export async function ouvrirCycle(client, idAffectation) {
  const delai = await delaiRevalidation(client, idAffectation);
  const { rows: [cycle] } = await client.query(
    `INSERT INTO revalidation (id_affectation, date_derniere_validation, date_prochaine_revalidation, statut)
     VALUES ($1, CURRENT_DATE, CURRENT_DATE + $2::int, 'a_jour')
     RETURNING date_derniere_validation::text AS date_derniere_validation,
               date_prochaine_revalidation::text AS date_prochaine_revalidation`,
    [idAffectation, delai]
  );
  await client.query(
    `UPDATE affectation SET date_revalidation = $1 WHERE id = $2`,
    [cycle.date_prochaine_revalidation, idAffectation]
  );
  return { ...cycle, delai_revalidation: delai };
}

// Miroir de la derniere entree physique du workflow sur la colonne v4
// affectation.id_validation_status. Jamais 'a_revalider' : ce statut n'existe
// qu'a la lecture.
export async function refleterStatut(client, idAffectation, codeStatut) {
  await client.query(
    `UPDATE affectation
        SET id_validation_status = (SELECT id FROM validation_status WHERE code = $2)
      WHERE id = $1`,
    [idAffectation, codeStatut]
  );
}

// Historique des declarations par societe (table historique_declaration).
// Une ligne par ecriture metier sur une affectation : creation, modification,
// suppression, validation, refus, revalidation. detail porte l'identite de
// l'affectation pour que l'historique reste lisible apres sa suppression.
export async function historiser(client, { idSociete, idUtilisateur, action, detail }) {
  await client.query(
    `INSERT INTO historique_declaration (id_societe, id_utilisateur, action, entite_type, detail)
     VALUES ($1, $2, $3, 'affectation', $4)`,
    [idSociete || null, idUtilisateur || null, action, detail ? JSON.stringify(detail) : null]
  );
}

// Identite minimale d'une affectation pour les traces (audit, historique).
export async function lireAffectation(client, idAffectation) {
  const { rows } = await client.query(
    `SELECT a.id, a.label, a.id_licence, a.id_societe, a.quantite, a.reference_client,
            a.date_revalidation::text AS date_revalidation,
            l.label AS licence_label, l.id_produit
       FROM affectation a
       LEFT JOIN licence l ON l.id = a.id_licence
      WHERE a.id = $1`,
    [idAffectation]
  );
  return rows[0] || null;
}

// Hook appele par validation.js apres le traitement d'une affectation, dans
// la meme transaction. Validation : ouverture du cycle. Refus : rien de plus
// que le miroir. Dans les deux cas, historique par societe et audit.
export async function apresTraitementAffectation(client, req, idAffectation, statutCible, motif) {
  await refleterStatut(client, idAffectation, statutCible);
  const aff = await lireAffectation(client, idAffectation);
  let cycle = null;
  if (statutCible === "valide") cycle = await ouvrirCycle(client, idAffectation);
  await historiser(client, {
    idSociete: aff?.id_societe,
    idUtilisateur: req.user?.id,
    action: statutCible === "valide" ? "VALIDATION" : "REFUS",
    detail: {
      id_affectation: idAffectation,
      reference_client: aff?.reference_client,
      quantite: aff?.quantite,
      id_licence: aff?.id_licence,
      ...(cycle ? { date_prochaine_revalidation: cycle.date_prochaine_revalidation, delai_revalidation: cycle.delai_revalidation } : {}),
      ...(motif ? { message_refus: motif } : {}),
    },
  });
  await auditer(client, req, {
    action: statutCible === "valide" ? "VALIDATION_AFFECTATION" : "REFUS_AFFECTATION",
    entiteType: "affectation",
    entiteId: idAffectation,
    avant: { statut_validation: "en_attente" },
    apres: { statut_validation: statutCible, ...(cycle || {}), ...(motif ? { message_refus: motif } : {}) },
  });
}
