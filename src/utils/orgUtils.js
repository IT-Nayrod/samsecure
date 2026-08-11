// orgUtils - Derivation organisation et hierarchie societes - SamSecure v0.5
// Fonctions pures sans React, sans etat, sans effet de bord.
// sources = { licences, commandes, societes }

/**
 * Retourne la societe payeuse d'une licence : licence.id_commande -> commande.id_societe -> societe.
 * Retourne null si la chaine est incomplete (licence ou commande introuvable).
 */
export function getSocieteDeLicence(idLicence, sources) {
  const licence = sources.licences.find(l => l.id === idLicence);
  if (!licence) return null;
  const commande = sources.commandes.find(k => k.id === licence.id_commande);
  if (!commande) return null;
  return sources.societes.find(s => s.id === commande.id_societe) ?? null;
}

/**
 * Retourne la liste de tous les ids descendants (directs et indirects) d'une societe.
 */
export function getDescendantes(idSociete, societes) {
  const directes = societes.filter(s => s.societe_parent_id === idSociete).map(s => s.id);
  return directes.reduce((acc, id) => [...acc, id, ...getDescendantes(id, societes)], []);
}

/**
 * Retourne le perimetre effectif du selecteur d'organisation :
 *   null           -> "Toutes les organisations" (aucun filtre)
 *   [idSociete]    -> la societe seule (consolider = false)
 *   [idSociete, ...descendantes] -> la societe + toutes ses filiales (consolider = true)
 */
export function getPerimetre(idSociete, consolider, societes) {
  if (!idSociete) return null;
  return consolider ? [idSociete, ...getDescendantes(idSociete, societes)] : [idSociete];
}

/**
 * Retourne true si la ligne budget appartient au perimetre d'organisation.
 * Si societeIds est null, retourne toujours true.
 * Si la licence n'est reliee a aucune commande : retourne false (sauf perimetre null).
 */
export function ligneDansPerimetre(ligneBudget, societeIds, sources) {
  if (!societeIds) return true;
  const societe = getSocieteDeLicence(ligneBudget.id_licence, sources);
  if (!societe) return false;
  return societeIds.includes(societe.id);
}
