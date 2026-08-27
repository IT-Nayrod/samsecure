// referentielsService - referentiels du module 1 : editeurs et logiciels.
//
// Meme convention que les autres services : aucun fetch direct, http.js porte
// le Bearer, le refresh sur 401 et la normalisation des erreurs en ApiError
// (message = champ "error" affiche tel quel, code = code_retour, #68) et le
// deballage de l'enveloppe { code, type, libelle, data }.
//
// Les logiciels melent deux origines, catalogue global et produits client, que
// l'API sert sous une forme unique : chaque ligne porte source et modifiable.
// Le front n'a pas a savoir de quelle base elle vient, seulement si elle
// s'ecrit.
import { http } from './http';

export const editeursService = {
  list:   ()            => http.get('/editeurs'),
  get:    (id)          => http.get(`/editeurs/${id}`),
  create: (payload)     => http.post('/editeurs', payload),
  update: (id, payload) => http.patch(`/editeurs/${id}`, payload),
  remove: (id)          => http.delete(`/editeurs/${id}`),
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
};

// Un produit porte les champs de son editeur a plat (editeur_label,
// editeur_url_logo_defaut, editeur_url_logo_custom), l'editeur vivant dans
// l'autre base et etant resolu par l'API. LogoEditeur attend la forme d'un
// editeur : ce petit adaptateur evite de le recopier dans chaque ecran.
export function editeurDuProduit(produit) {
  if (!produit?.id_editeur) return null;
  return {
    id: produit.id_editeur,
    raison_sociale: produit.editeur_label,
    url_logo_defaut: produit.editeur_url_logo_defaut,
    url_logo_custom: produit.editeur_url_logo_custom,
  };
}
