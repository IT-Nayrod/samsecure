// libelleContrat - libellé d'un contrat partout où il s'affiche (#203 pour les
// sélecteurs et la hiérarchie ; étendu le 16/09/2026 en réunion client aux
// listes, fiches, rattachements et exports) : « Libellé (Société) ».
// La société signataire est servie par GET /contrats (societe_label, et
// parent_societe_label pour le parent) et, sur les objets rattachés à un
// contrat, par contrat_societe_label (GET /preuves, /factures, /licences). Les
// écrans dont les lignes ne portent que contrat_label la résolvent par
// societeParContrat() depuis la liste des contrats qu'ils chargent déjà. Un
// contrat sans société connue garde son seul libellé : le format s'enrichit
// dès que la donnée est servie, sans autre changement d'écran.
export function libelleContrat(label, societeLabel) {
  if (!label) return label ?? null;
  return societeLabel ? `${label} (${societeLabel})` : label;
}

// Index id_contrat vers société signataire, à partir d'une liste GET /contrats.
export function societeParContrat(contrats = []) {
  return new Map((contrats ?? []).map(c => [c.id, c.societe_label ?? null]));
}
