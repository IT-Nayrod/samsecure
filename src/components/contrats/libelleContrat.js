// libelleContrat - libellé d'un contrat partout où il s'affiche (#203 pour les
// sélecteurs et la hiérarchie ; étendu le 16/09/2026 en réunion client aux
// listes, fiches, rattachements et exports) : « Libellé (Société) ».
// La société signataire est servie par l'API : societe_label (et
// parent_societe_label, predecesseur_societe_label) sur GET /contrats, et
// contrat_societe_label sur tout objet rattaché à un contrat (GET /commandes,
// /commandes/manques, /preuves, /factures, /licences, /budget). Aucune
// résolution côté front : un contrat sans société connue garde son seul
// libellé, le format s'enrichit dès que la donnée est servie.
export function libelleContrat(label, societeLabel) {
  if (!label) return label ?? null;
  return societeLabel ? `${label} (${societeLabel})` : label;
}
