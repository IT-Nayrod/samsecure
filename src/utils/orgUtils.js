// Dérivation de l'organisation payeuse et hiérarchie des sociétés.
// Fonctions pures sans React, sans état, sans effet de bord.
// sources = { licences, commandes, societes }

/**
 * Retourne la société payeuse d'une licence : licence.id_commande -> commande.id_societe -> société.
 * Retourne null si la chaîne est incomplète (licence ou commande introuvable).
 */
export function getSocieteDeLicence(idLicence, sources) {
  const licence = sources.licences.find(l => l.id === idLicence);
  if (!licence) return null;
  const commande = sources.commandes.find(k => k.id === licence.id_commande);
  if (!commande) return null;
  return sources.societes.find(s => s.id === commande.id_societe) ?? null;
}

/**
 * Retourne la liste de tous les ids descendants (directs et indirects) d'une société.
 */
export function getDescendantes(idSociete, societes) {
  const directes = societes.filter(s => s.societe_parent_id === idSociete).map(s => s.id);
  return directes.reduce((acc, id) => [...acc, id, ...getDescendantes(id, societes)], []);
}

/**
 * Retourne le périmètre effectif du sélecteur d'organisation :
 *   null           -> "Toutes les organisations" (aucun filtre)
 *   [idSociete]    -> la société seule (consolider = false)
 *   [idSociete, ...descendantes] -> la société + toutes ses filiales (consolider = true)
 */
export function getPerimetre(idSociete, consolider, societes) {
  if (!idSociete) return null;
  return consolider ? [idSociete, ...getDescendantes(idSociete, societes)] : [idSociete];
}

/**
 * Retourne true si la ligne budget appartient au périmètre d'organisation.
 * Si societeIds est null, retourne toujours true.
 * Si la licence n'est reliée à aucune commande : retourne false (sauf périmètre null).
 */
export function ligneDansPerimetre(ligneBudget, societeIds, sources) {
  if (!societeIds) return true;
  const societe = getSocieteDeLicence(ligneBudget.id_licence, sources);
  if (!societe) return false;
  return societeIds.includes(societe.id);
}
