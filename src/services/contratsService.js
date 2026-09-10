// contratsService - accès API du module contrats.
// Même convention que adminService : aucun fetch direct, aucune gestion de token,
// http.js porte déjà le Bearer, le refresh sur 401 et la normalisation des
// erreurs en ApiError (message = champ "error", code = code_retour, #68) et
// le déballage de l'enveloppe { code, type, libelle, data }.
// La projection /contrats est déjà en snake_case : pas de normalizeX ici,
// contrairement à /societes.
import { http } from './http';

export const contratsService = {
  // Les contrats archivés sont exclus par défaut ; inclureArchives les ajoute,
  // chaque ligne portant archive / date_archivage pour les distinguer (#96).
  list:   ({ inclureArchives = false } = {}) => http.get(`/contrats${inclureArchives ? '?inclure_archives=1' : ''}`),
  get:    (id)          => http.get(`/contrats/${id}`),
  create: (payload)     => http.post('/contrats', payload),
  update: (id, payload) => http.patch(`/contrats/${id}`, payload),
  remove: (id)          => http.delete(`/contrats/${id}`),
  archiver:  (id)       => http.post(`/contrats/${id}/archiver`),
  restaurer: (id)       => http.post(`/contrats/${id}/restaurer`),
};

export const referentielsContratsService = {
  typesContrat: () => http.get('/types-contrat'),
  editeurs:     () => http.get('/editeurs'),
  revendeurs:   () => http.get('/revendeurs'),
};
