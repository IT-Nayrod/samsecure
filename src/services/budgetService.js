// budgetService - acces API du module budget (US #148, page et fiches ;
// API livree par la #146).
// Meme convention que licencesService et contratsService : aucun fetch direct,
// http.js porte le Bearer, le refresh sur 401, la normalisation des erreurs en
// ApiError (message = champ "error" de l'enveloppe, code = code_retour
// 5100-5199) et le deballage de l'enveloppe { code, type, libelle, data }.
// La projection /budget est en snake_case, servie telle quelle : organisation
// payeuse, commande, contrat, editeur et produit y sont deduits par l'API
// (chaine licence -> commande -> societe), jamais saisis ni recalcules ici.
// Une fonction par appel, aucune logique metier.
import { http } from './http';

// Un selecteur vide envoie '' : c'est une absence de filtre, jamais une valeur.
function query(filtres = {}) {
  const q = new URLSearchParams(
    Object.entries(filtres).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return q ? `?${q}` : '';
}

export const budgetService = {
  // Filtres acceptes par le routeur : id_licence, id_societe, id_editeur,
  // id_contrat, id_commande, type, exercice, ou plage date_debut / date_fin
  // (recouvrement de la periode de la ligne).
  list:   (filtres = {}) => http.get(`/budget${query(filtres)}`),
  get:    (id)           => http.get(`/budget/${id}`),
  create: (payload)      => http.post('/budget', payload),
  update: (id, payload)  => http.patch(`/budget/${id}`, payload),
  remove: (id)           => http.delete(`/budget/${id}`),

  // Projection previsionnelle depuis la maintenance en cours (rien n'est
  // ecrit). exercice facultatif : a defaut l'API vise l'exercice courant + 1.
  preremplissage: ({ id_licence, exercice } = {}) =>
    http.get(`/budget/preremplissage${query({ id_licence, exercice })}`),

  // Engage et synthese : axes id_societe, id_editeur, id_contrat, id_licence ;
  // periode par exercice (avec id_societe pour l'ancrage fiscal) ou par plage
  // date_debut / date_fin.
  engage:   (filtres = {}) => http.get(`/budget/engage${query(filtres)}`),
  synthese: (filtres = {}) => http.get(`/budget/synthese${query(filtres)}`),
};
