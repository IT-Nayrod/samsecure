// preuveAffichage - règles d'affichage d'une preuve, partagées par la liste,
// la fiche document, la fiche commande, la fiche contrat et la section preuves
// de la licence (#215, unification de l'affichage). Aucune de ces règles ne
// distingue la nature preuve ou facture : la seule trace de la table facture
// est l'entité visée par la validation, invisible à l'écran.
import { libelleContrat } from './libelleContrat';

// Contrat affiché pour une preuve : le rattachement direct quand il existe,
// sinon le contrat de la commande rattachée (servi par l'API sous
// id_contrat_commande et ses libellés). Format « Libellé (Société) ».
export function contratDeLaPreuve(p) {
  if (!p) return null;
  if (p.id_contrat) return libelleContrat(p.contrat_label, p.contrat_societe_label);
  if (p.id_contrat_commande) return libelleContrat(p.contrat_commande_label, p.contrat_commande_societe_label);
  return null;
}

// Identifiant du contrat affiché, pour le lien vers sa fiche.
export function idContratDeLaPreuve(p) {
  return p?.id_contrat ?? p?.id_contrat_commande ?? null;
}

// Entité du workflow visée par une preuve : la facture porte la demande quand
// la preuve en est le support (#204), la preuve sinon.
export function cibleValidation(p) {
  return p.id_facture ? { entite: 'facture', id: p.id_facture } : { entite: 'preuve', id: p.id };
}

// Un fichier a réellement été déposé : url_fichier est un nom physique et non
// la valeur d'attente posée par le circuit simple avant le dépôt.
export function fichierDepose(p) {
  return !!p?.url_fichier && p.url_fichier !== 'en-attente-de-depot';
}
