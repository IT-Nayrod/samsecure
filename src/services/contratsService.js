// contratsService - acces API du module contrats.
// Meme convention que adminService : aucun fetch direct, aucune gestion de token,
// http.js porte deja le Bearer, le refresh sur 401 et la normalisation des
// erreurs en ApiError dont le message est le champ "error" du serveur.
// La projection /contrats est deja en snake_case : pas de normalizeX ici,
// contrairement a /societes.
import { http } from './http';

export const contratsService = {
  list:   ()            => http.get('/contrats'),
  get:    (id)          => http.get(`/contrats/${id}`),
  create: (payload)     => http.post('/contrats', payload),
  update: (id, payload) => http.patch(`/contrats/${id}`, payload),
  remove: (id)          => http.delete(`/contrats/${id}`),
};

export const referentielsContratsService = {
  typesContrat: () => http.get('/types-contrat'),
  editeurs:     () => http.get('/editeurs'),
  revendeurs:   () => http.get('/revendeurs'),
};
