// conformiteService - accès API du module 3, conformité, qualité des saisies
// et indice de confiance (US #116, API de la même story).
// Même convention que budgetService et licencesService : aucun fetch direct,
// http.js porte le Bearer, le refresh sur 401, la normalisation des erreurs en
// ApiError (message = champ "error" de l'enveloppe, code = code_retour
// 4300-4399 et 5400-5449) et le déballage de l'enveloppe.
// Les projections sont en snake_case, servies telles quelles. prix_unitaire,
// ecart_valorise, les agrégats ecart_valorise_negatif / _positif (sommes
// signées) et valeur_totale sortent à null avec montants_masques: true sans
// consulter_kpi_financiers : ne jamais confondre "masque" et "0".
// Une fonction par appel, aucune logique métier.
import { http } from './http';

// Un sélecteur vide envoie '' : c'est une absence de filtre, jamais une valeur.
function query(filtres = {}) {
  const q = new URLSearchParams(
    Object.entries(filtres).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return q ? `?${q}` : '';
}

export const conformiteService = {
  // Lignes par produit { id_produit, produit_label, id_editeur, editeur_label,
  // unite, droits_total, usages_total, ecart, ecart_pct, prix_unitaire,
  // ecart_valorise, statut_conformite, derniere_maj } + agrégats
  // { nb_produits, nb_depassement, nb_attention, nb_conforme,
  // ecart_valorise_negatif, ecart_valorise_positif, derniere_maj }.
  // Filtres acceptés : id_societe, id_editeur, id_produit.
  conformite: (filtres = {}) => http.get(`/conformite${query(filtres)}`),

  // Mêmes agrégats par ligne du niveau demandé : global (une ligne), éditeur
  // ({ id_editeur, editeur_label, ...agregats }) ou société ({ id_societe,
  // societe_label, ...agregats }).
  synthese: (niveau = 'global') => http.get(`/conformite/synthese${query({ niveau })}`),

  // { total, par_type: { type: nombre }, éléments: [{ type_anomalie, gravite,
  // entite_type, entite_id, libelle, description }] }.
  qualite: () => http.get('/qualite'),

  // { indice, exhaustivite, coherence, fraicheur, valeur_totale, malus:
  // [{ composante, libelle, points, entite_type, entite_ids }] }.
  // Filtre accepte : id_societe.
  confiance: (filtres = {}) => http.get(`/confiance${query(filtres)}`),
};
