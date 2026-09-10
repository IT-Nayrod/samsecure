// budgetService - accès API du module budget (US #148, page et fiches ;
// API livree par la #146).
// Même convention que licencesService et contratsService : aucun fetch direct,
// http.js porte le Bearer, le refresh sur 401, la normalisation des erreurs en
// ApiError (message = champ "error" de l'enveloppe, code = code_retour
// 5100-5199) et le déballage de l'enveloppe { code, type, libelle, data }.
// La projection /budget est en snake_case, servie telle quelle : organisation
// payeuse, commande, contrat, éditeur et produit y sont déduits par l'API
// (chaîne licence -> commande -> société), jamais saisis ni recalculés ici.
// Une fonction par appel, aucune logique métier.
import { http } from './http';

// Un sélecteur vide envoie '' : c'est une absence de filtre, jamais une valeur.
function query(filtres = {}) {
  const q = new URLSearchParams(
    Object.entries(filtres).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return q ? `?${q}` : '';
}

export const budgetService = {
  // Filtres acceptés par le routeur : id_licence, id_societe, id_editeur,
  // id_contrat, id_commande, type, exercice, ou plage date_debut / date_fin
  // (recouvrement de la période de la ligne).
  list:   (filtres = {}) => http.get(`/budget${query(filtres)}`),
  get:    (id)           => http.get(`/budget/${id}`),
  create: (payload)      => http.post('/budget', payload),
  update: (id, payload)  => http.patch(`/budget/${id}`, payload),
  remove: (id)           => http.delete(`/budget/${id}`),

  // Projection prévisionnelle depuis la maintenance en cours (rien n'est
  // écrit). exercice facultatif : à défaut l'API vise l'exercice courant + 1.
  preremplissage: ({ id_licence, exercice } = {}) =>
    http.get(`/budget/preremplissage${query({ id_licence, exercice })}`),

  // Engagé et synthèse : axes id_societe, id_editeur, id_contrat, id_licence ;
  // période par exercice (avec id_societe pour l'ancrage fiscal) ou par plage
  // date_debut / date_fin.
  engage:   (filtres = {}) => http.get(`/budget/engage${query(filtres)}`),
  synthese: (filtres = {}) => http.get(`/budget/synthese${query(filtres)}`),
};
