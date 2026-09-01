// conformiteService - acces API du module 3, conformite, qualite des saisies
// et indice de confiance (US #116, API de la meme story).
// Meme convention que budgetService et licencesService : aucun fetch direct,
// http.js porte le Bearer, le refresh sur 401, la normalisation des erreurs en
// ApiError (message = champ "error" de l'enveloppe, code = code_retour
// 4300-4399 et 5400-5449) et le deballage de l'enveloppe.
// Les projections sont en snake_case, servies telles quelles. prix_unitaire,
// ecart_valorise, les agregats ecart_valorise_negatif / _positif (sommes
// signees) et valeur_totale sortent a null avec montants_masques: true sans
// consulter_kpi_financiers : ne jamais confondre "masque" et "0".
// Une fonction par appel, aucune logique metier.
import { http } from './http';

// Un selecteur vide envoie '' : c'est une absence de filtre, jamais une valeur.
function query(filtres = {}) {
  const q = new URLSearchParams(
    Object.entries(filtres).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return q ? `?${q}` : '';
}

export const conformiteService = {
  // Lignes par produit { id_produit, produit_label, id_editeur, editeur_label,
  // unite, droits_total, usages_total, ecart, ecart_pct, prix_unitaire,
  // ecart_valorise, statut_conformite, derniere_maj } + agregats
  // { nb_produits, nb_depassement, nb_attention, nb_conforme,
  // ecart_valorise_negatif, ecart_valorise_positif, derniere_maj }.
  // Filtres acceptes : id_societe, id_editeur, id_produit.
  conformite: (filtres = {}) => http.get(`/conformite${query(filtres)}`),

  // Memes agregats par ligne du niveau demande : global (une ligne), editeur
  // ({ id_editeur, editeur_label, ...agregats }) ou societe ({ id_societe,
  // societe_label, ...agregats }).
  synthese: (niveau = 'global') => http.get(`/conformite/synthese${query({ niveau })}`),

  // { total, par_type: { type: nombre }, elements: [{ type_anomalie, gravite,
  // entite_type, entite_id, libelle, description }] }.
  qualite: () => http.get('/qualite'),

  // { indice, exhaustivite, coherence, fraicheur, valeur_totale, malus:
  // [{ composante, libelle, points, entite_type, entite_ids }] }.
  // Filtre accepte : id_societe.
  confiance: (filtres = {}) => http.get(`/confiance${query(filtres)}`),
};
