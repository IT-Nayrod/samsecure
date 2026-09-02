// notificationsService - acces API du module notifications (story #121).
// Meme convention que dashboardService et validationService : aucun fetch
// direct, http.js porte le Bearer, le refresh sur 401, la normalisation des
// erreurs en ApiError (message = champ "error" de l'enveloppe, code =
// code_retour 5500-5549) et le deballage de l'enveloppe.
// Une fonction par appel, aucune logique metier. Toutes les routes sont
// personnelles : l'API ne sert que les notifications de l'utilisateur du jeton.
import { http } from './http';

function query(filtres = {}) {
  const q = new URLSearchParams(
    Object.entries(filtres).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return q ? `?${q}` : '';
}

export const notificationsService = {
  // { notifications[], page, limite, total, non_lues, total_page }
  // filtres : lu (true|false), page, limite (200 au plus)
  liste: (filtres = {}) => http.get(`/notifications${query(filtres)}`),

  // { non_lues } : rafraichi toutes les 60 secondes par la cloche.
  compteur: () => http.get('/notifications/compteur'),

  // { notification, non_lues }
  marquerLu: (id) => http.patch(`/notifications/${id}/lu`),

  // { marquees, non_lues }
  toutLu: () => http.post('/notifications/tout-lu'),

  // { modes[] { code, libelle }, preferences[] { type, libelle, description,
  //   courrier, courrier_defaut, source } }
  preferences: () => http.get('/notifications/preferences'),

  // preferences : [{ type, courrier }] ; renvoie la meme forme que le GET.
  enregistrerPreferences: (preferences) =>
    http.put('/notifications/preferences', { preferences }),

  // Reserve a l'administrateur : traitement quotidien puis recapitulatif.
  executerPlanification: () => http.post('/notifications/executer-planification'),
};
