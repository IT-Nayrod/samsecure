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

// Support d'une preuve (#220, preuve externe) : fichier déposé dans SamSecure,
// ou document externe désigné par une URL ou par une référence libre. Les codes
// sont ceux de preuve.mode (migration 072), servis par l'API ; une preuve servie
// sans mode (API non migrée) se lit comme un fichier.
export const MODES_PREUVE = [
  { code: 'fichier',   label: 'Fichier' },
  { code: 'url',       label: 'URL externe' },
  { code: 'reference', label: 'Référence' },
];

export function modeDeLaPreuve(p) {
  return p?.mode ?? 'fichier';
}

export function libelleMode(p) {
  const mode = modeDeLaPreuve(p);
  return MODES_PREUVE.find(m => m.code === mode)?.label ?? mode;
}

// Le document vit ailleurs : aucun fichier à ouvrir ni à déposer.
export function preuveExterne(p) {
  return modeDeLaPreuve(p) !== 'fichier';
}

// URL rendue en lien cliquable seulement si elle est http ou https. L'API le
// garantit à la saisie (3236) ; ce second contrôle tient une valeur arrivée en
// base par un autre chemin hors d'un href (javascript:, data:), affichée alors
// en simple texte.
export function urlExterneSure(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim()) ? url.trim() : null;
}

// Forme attendue d'une empreinte SHA-256 saisie à la main (contrôle 3218 du
// serveur) : le formulaire s'en sert pour ne pas envoyer une requête vouée au
// refus, jamais pour reconstruire le message.
export const SHA256_RE = /^[0-9a-f]{64}$/i;

// Empreinte abrégée pour les listes : le début suffit à la reconnaître,
// l'infobulle porte la valeur entière.
export function empreinteAbregee(hash) {
  return hash ? `${hash.slice(0, 12)}…` : null;
}

// Support d'une preuve en une ligne de texte, pour l'export CSV et les listes.
export function supportEnTexte(p) {
  const mode = modeDeLaPreuve(p);
  if (mode === 'url') return `URL externe : ${p.url_externe ?? ''}`;
  if (mode === 'reference') return `Référence : ${p.reference_externe ?? ''}`;
  return 'Fichier';
}

// Un fichier a réellement été déposé : url_fichier est un nom physique et non
// la valeur d'attente posée par le circuit simple avant le dépôt. Jamais vrai
// pour une preuve externe (#220), dont url_fichier est nul : c'est cette règle
// qui retire le bouton « Ouvrir le fichier » de tous les écrans qui
// l'affichent (liste, fiches document, commande, contrat et licence).
export function fichierDepose(p) {
  return !preuveExterne(p) && !!p?.url_fichier && p.url_fichier !== 'en-attente-de-depot';
}
