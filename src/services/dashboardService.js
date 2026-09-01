// dashboardService - acces API du module dashboards (US #190, taches #191 et
// #192). Meme convention que budgetService et contratsService : aucun fetch
// direct, http.js porte le Bearer, le refresh sur 401, la normalisation des
// erreurs en ApiError (message = champ "error" de l'enveloppe, code =
// code_retour 5450-5499) et le deballage de l'enveloppe.
// Une fonction par appel, aucune logique metier.
//
// Deux familles d'appels :
//   - le routeur dashboards (configuration, preferences, synthese, agregats
//     financiers par axe) ;
//   - le contrat d'interface conformite / qualite / confiance, en cours
//     d'ecriture en parallele : ces fonctions sont codees contre le contrat,
//     un 404 a l'integration est rendu tel quel et le widget affiche son
//     etat d'erreur propre.
import { http } from './http';

// Un selecteur vide envoie '' : c'est une absence de filtre, jamais une valeur.
function query(filtres = {}) {
  const q = new URLSearchParams(
    Object.entries(filtres).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return q ? `?${q}` : '';
}

export const dashboardService = {
  // Configuration complete : widgets par profil (defauts Commune surcharges
  // par le tenant), seuils effectifs, preferences individuelles, profil actif.
  configuration: () => http.get('/dashboards/configuration'),

  // Masquage et ordre des widgets de l'utilisateur connecte.
  // prefs : [{ widget_code, visible, position }]
  enregistrerPreferences: (prefs) =>
    http.put('/dashboards/preferences', { preferences: prefs }),

  // Compteurs du workflow de validation, fil des dernieres saisies,
  // repartition des revalidations par proximite d'echeance.
  synthese: () => http.get('/dashboards/synthese'),

  // Montants totaux par axe (editeur, societe, produit), periode optionnelle
  // date_debut / date_fin sur la date de commande.
  montantsTotaux: (filtres = {}) => http.get(`/dashboards/montants-totaux${query(filtres)}`),

  // Montants commandes et payes par editeur (precalcul_financier), periode
  // optionnelle date_debut / date_fin, filtre id_societe.
  engagesPayes: (filtres = {}) => http.get(`/dashboards/engages-payes${query(filtres)}`),
};

// Contrat d'interface conformite, qualite des saisies et indice de confiance
// (routes ecrites en parallele sur le meme contrat).
export const conformiteService = {
  // Filtres : id_societe, id_editeur, id_produit. Reponse : lignes[] par
  // produit (droits, usages, ecart, ecart_pct, ecart_valorise, statut) et
  // agregats (nb par statut, ecarts valorises, derniere_maj).
  list: (filtres = {}) => http.get(`/conformite${query(filtres)}`),

  // niveau : global, editeur ou societe. Memes agregats par ligne.
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
