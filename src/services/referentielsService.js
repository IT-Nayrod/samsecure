// referentielsService - référentiels du module 1 : éditeurs et logiciels.
//
// Même convention que les autres services : aucun fetch direct, http.js porte
// le Bearer, le refresh sur 401 et la normalisation des erreurs en ApiError
// (message = champ "error" affiché tel quel, code = code_retour, #68) et le
// déballage de l'enveloppe { code, type, libelle, data }.
//
// Les logiciels mêlent deux origines, catalogue global et produits client, que
// l'API sert sous une forme unique : chaque ligne porte source et modifiable.
// Le front n'a pas à savoir de quelle base elle vient, seulement si elle
// s'écrit.
import { http } from './http';

export const editeursService = {
  list:   ()            => http.get('/editeurs'),
  get:    (id)          => http.get(`/editeurs/${id}`),
  create: (payload)     => http.post('/editeurs', payload),
  update: (id, payload) => http.patch(`/editeurs/${id}`, payload),
  remove: (id)          => http.delete(`/editeurs/${id}`),

  // Recherche incrémentale du formulaire, appelée au fil de la frappe. Sert une
  // réponse pauvre et bornée ({ suggestions, total }), sans les compteurs ni la
  // conformité de list() : une frappe ne doit pas coûter une lecture des deux
  // bases. exclure écarte l'éditeur en cours de modification.
  rechercher: (q, { exclure, limite } = {}) => {
    const params = new URLSearchParams({ q });
    if (exclure) params.set('exclure', exclure);
    if (limite) params.set('limite', String(limite));
    return http.get(`/editeurs/recherche?${params.toString()}`);
  },
};

export const logicielsService = {
  list:   ()            => http.get('/logiciels'),
  get:    (id)          => http.get(`/logiciels/${id}`),
  create: (payload)     => http.post('/logiciels', payload),
  update: (id, payload) => http.patch(`/logiciels/${id}`, payload),
  remove: (id)          => http.delete(`/logiciels/${id}`),

  addVersion:    (id, label)      => http.post(`/logiciels/${id}/versions`, { label }),
  removeVersion: (id, idVersion)  => http.delete(`/logiciels/${id}/versions/${idVersion}`),
  addEdition:    (id, label)      => http.post(`/logiciels/${id}/editions`, { label }),
  removeEdition: (id, idEdition)  => http.delete(`/logiciels/${id}/editions/${idEdition}`),

  // Composition d'un logiciel composé (#216) : s'écrit sur un logiciel du
  // catalogue comme sur un logiciel client. Les refus (éditeur différent,
  // doublon, composé déjà composant) viennent du serveur, affichés tels quels.
  addComposant:    (id, idComposant) => http.post(`/logiciels/${id}/composants`, { id_produit_composant: idComposant }),
  removeComposant: (id, idComposant) => http.delete(`/logiciels/${id}/composants/${idComposant}`),
};

export const revendeursService = {
  // Les désactivés sont masqués par défaut côté API : cette même route sert de
  // sélecteur aux formulaires contrat et commande, ou proposer un revendeur
  // retiré du catalogue serait une erreur.
  list:   ({ inclureInactifs = false } = {}) =>
    http.get(`/revendeurs${inclureInactifs ? '?inclure_inactifs=1' : ''}`),
  get:    (id)          => http.get(`/revendeurs/${id}`),
  create: (payload)     => http.post('/revendeurs', payload),
  update: (id, payload) => http.patch(`/revendeurs/${id}`, payload),

  // Pas de suppression : quatre tables référencent un revendeur et doivent
  // continuer de le nommer. Le retrait est réversible.
  desactiver: (id) => http.post(`/revendeurs/${id}/desactiver`),
  reactiver:  (id) => http.post(`/revendeurs/${id}/reactiver`),

  // Recherche incrémentale du formulaire, appelée au fil de la frappe. Réponse
  // pauvre et bornée ({ suggestions, total }), insensible à la casse et aux
  // accents. exclure écarte le revendeur en cours de modification.
  rechercher: (q, { exclure, limite } = {}) => {
    const params = new URLSearchParams({ q });
    if (exclure) params.set('exclure', exclure);
    if (limite) params.set('limite', String(limite));
    return http.get(`/revendeurs/recherche?${params.toString()}`);
  },
};

// Un produit porte les champs de son éditeur à plat (editeur_label,
// editeur_url_logo_defaut, editeur_url_logo_custom), l'éditeur vivant dans
// l'autre base et étant résolu par l'API. LogoEditeur attend la forme d'un
// éditeur : ce petit adaptateur évite de le recopier dans chaque écran.
export function editeurDuProduit(produit) {
  if (!produit?.id_editeur) return null;
  return {
    id: produit.id_editeur,
    raison_sociale: produit.editeur_label,
    url_logo_defaut: produit.editeur_url_logo_defaut,
    url_logo_custom: produit.editeur_url_logo_custom,
  };
}
