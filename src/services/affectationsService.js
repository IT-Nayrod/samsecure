// affectationsService - accès API du module 3, bloc affectations (#106).
// Même convention que commandesService : aucun fetch direct, http.js porte le
// Bearer, le refresh sur 401, la normalisation des erreurs en ApiError
// (message = champ "error", code = code_retour) et le déballage de l'enveloppe.
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
  // Décompte pour la conformité : somme brute par produit et société.
  decompte:  (filtres)      => http.get(avecParams('/affectations/decompte', filtres)),
  // Historique des déclarations (table historique_declaration) par société,
  // ou restreint à une affectation.
  historique: (filtres)     => http.get(avecParams('/affectations/historique', filtres)),
};

export const licencesService = {
  list: () => http.get('/licences'),
};
