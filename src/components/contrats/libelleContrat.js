// libelleContrat - libellé d'un contrat dans les sélecteurs et la hiérarchie
// (#203) : « Libellé (Société) ». La société signataire est servie par
// GET /contrats (societe_label) et, pour le parent, par parent_societe_label.
// Un contrat sans société garde son seul libellé.
export function libelleContrat(label, societeLabel) {
  return societeLabel ? `${label} (${societeLabel})` : label;
}
