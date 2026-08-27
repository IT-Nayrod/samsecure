// licencesService - acces API du module licences (US #102).
// Meme convention que contratsService : aucun fetch direct, http.js porte le
// Bearer, le refresh sur 401, la normalisation des erreurs en ApiError (code =
// code_retour 4000-4099) et le deballage de l'enveloppe { code, type, libelle, data }.
// La projection /licences est en snake_case, servie telle quelle. Les montants
// (cout_licence, cout de maintenance) arrivent a null avec montants_masques =
// true quand l'utilisateur n'a pas consulter_kpi_financiers : ne jamais les
// afficher comme un zero.
import { http } from './http';

export const licencesService = {
  list:   (filtres = {}) => {
    const q = new URLSearchParams(Object.entries(filtres).filter(([, v]) => v)).toString();
    return http.get(`/licences${q ? `?${q}` : ''}`);
  },
  get:    (id)          => http.get(`/licences/${id}`),
  create: (payload)     => http.post('/licences', payload),
  update: (id, payload) => http.patch(`/licences/${id}`, payload),
  remove: (id)          => http.delete(`/licences/${id}`),

  maintenance: {
    list:   (id)                 => http.get(`/licences/${id}/maintenance`),
    create: (id, payload)        => http.post(`/licences/${id}/maintenance`, payload),
    update: (id, mid, payload)   => http.patch(`/licences/${id}/maintenance/${mid}`, payload),
    remove: (id, mid)            => http.delete(`/licences/${id}/maintenance/${mid}`),
  },
  // Arret : fige la version et la date, sans retirer de droit quantitatif.
  // Reprise : annule un arret saisi par erreur, libere la version.
  arreterMaintenance:  (id, payload = {}) => http.post(`/licences/${id}/arret-maintenance`, payload),
  reprendreMaintenance: (id)              => http.post(`/licences/${id}/reprise-maintenance`, {}),
};

// Referentiels du module : catalogue des produits (BDD Commune, versions et
// editions imbriquees, editeur resolu), unites de mesure, mainteneurs.
export const referentielsLicencesService = {
  produits:     () => http.get('/produits'),
  unitesMesure: () => http.get('/unites-mesure'),
  mainteneurs:  () => http.get('/mainteneurs'),
};

// Montant tel que servi par l'API : null vaut "masque" (ou non renseigne),
// jamais zero. Affichage unique pour toutes les vues du module.
export function formatMontant(valeur, masque = false) {
  if (masque) return 'Masqué';
  if (valeur === null || valeur === undefined) return '-';
  return `${Number(valeur).toLocaleString('fr-FR')} €`;
}

// L'API sert url_logo_defaut (ex. /logos/microsoft.svg) ; LogoEditeur attend
// un logo_slug. Conversion locale, sans toucher au composant partage.
export function editeurPourLogo(raisonSociale, urlLogo) {
  if (!raisonSociale) return null;
  const m = /\/logos\/([^/]+)\.svg$/.exec(urlLogo ?? '');
  return { raison_sociale: raisonSociale, logo_slug: m ? m[1] : null };
}
