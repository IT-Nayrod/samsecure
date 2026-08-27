// affectationsService - acces API du module 3, bloc affectations (#106).
// Meme convention que commandesService : aucun fetch direct, http.js porte le
// Bearer, le refresh sur 401, la normalisation des erreurs en ApiError
// (message = champ "error", code = code_retour) et le deballage de l'enveloppe.
// La validation et le refus passent par validationService avec l'entite_type
// "affectation" : circuit unique du module 2, pas de second workflow.
import { http } from './http';

function avecParams(base, params = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const q = p.toString();
  return q ? `${base}?${q}` : base;
}

export const affectationsService = {
  list:      (filtres)      => http.get(avecParams('/affectations', filtres)),
  get:       (id)           => http.get(`/affectations/${id}`),
  create:    (payload)      => http.post('/affectations', payload),
  update:    (id, payload)  => http.patch(`/affectations/${id}`, payload),
  remove:    (id)           => http.delete(`/affectations/${id}`),
  revalider: (id)           => http.post(`/affectations/${id}/revalider`),
  // Decompte pour la conformite : somme brute par produit et societe.
  decompte:  (filtres)      => http.get(avecParams('/affectations/decompte', filtres)),
  // Historique des declarations (table historique_declaration) par societe,
  // ou restreint a une affectation.
  historique: (filtres)     => http.get(avecParams('/affectations/historique', filtres)),
};

export const licencesService = {
  list: () => http.get('/licences'),
};
