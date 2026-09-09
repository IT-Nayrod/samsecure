// dashboardService - accès API du module dashboards (US #190, tâches #191 et
// #192). Même convention que budgetService et contratsService : aucun fetch
// direct, http.js porte le Bearer, le refresh sur 401, la normalisation des
// erreurs en ApiError (message = champ "error" de l'enveloppe, code =
// code_retour 5450-5499) et le déballage de l'enveloppe.
// Une fonction par appel, aucune logique métier.
//
// Deux familles d'appels :
//   - le routeur dashboards (configuration, préférences, synthèse, agrégats
//     financiers par axe) ;
//   - le contrat d'interface conformité / qualité / confiance, en cours
//     d'écriture en parallèle : ces fonctions sont codées contre le contrat,
//     un 404 à l'intégration est rendu tel quel et le widget affiche son
//     état d'erreur propre.
import { http } from './http';

// Un sélecteur vide envoie '' : c'est une absence de filtre, jamais une valeur.
function query(filtres = {}) {
  const q = new URLSearchParams(
    Object.entries(filtres).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return q ? `?${q}` : '';
}

export const dashboardService = {
  // Configuration complète : widgets par profil (défauts Commune surchargés
  // par le tenant), seuils effectifs, préférences individuelles, profil actif.
  configuration: () => http.get('/dashboards/configuration'),

  // Masquage et ordre des widgets de l'utilisateur connecté.
  // prefs : [{ widget_code, visible, position }]
  enregistrerPreferences: (prefs) =>
    http.put('/dashboards/preferences', { preferences: prefs }),

  // Compteurs du workflow de validation, fil des dernières saisies,
  // répartition des revalidations par proximité d'échéance.
  synthese: () => http.get('/dashboards/synthese'),

  // Montants totaux par axe (editeur, societe, produit), période optionnelle
  // date_debut / date_fin sur la date de commande.
  montantsTotaux: (filtres = {}) => http.get(`/dashboards/montants-totaux${query(filtres)}`),

  // Montants commandes et payés par éditeur (precalcul_financier), période
  // optionnelle date_debut / date_fin, filtre id_societe.
  engagesPayes: (filtres = {}) => http.get(`/dashboards/engages-payes${query(filtres)}`),
};

// Contrat d'interface conformité, qualité des saisies et indice de confiance
// (routes écrites en parallèle sur le même contrat).
export const conformiteService = {
  // Filtres : id_societe, id_editeur, id_produit. Réponse : lignes[] par
  // produit (droits, usages, ecart, ecart_pct, ecart_valorise, statut) et
  // agrégats (nb par statut, écarts valorisés, derniere_maj).
  list: (filtres = {}) => http.get(`/conformite${query(filtres)}`),

  // niveau : global, éditeur ou société. Mêmes agrégats par ligne.
  synthese: (niveau = 'global') => http.get(`/conformite/synthese${query({ niveau })}`),
};

export const qualiteService = {
  // { total, par_type, elements[] { type_anomalie, gravite, entite_type,
  //   entite_id, libelle, description } }
  list: () => http.get('/qualite'),
};

export const confianceService = {
  // { indice, exhaustivite, coherence, fraicheur, valeur_totale, malus[] }
  get: (id_societe) => http.get(`/confiance${query({ id_societe })}`),
};
