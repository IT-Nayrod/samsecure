// contactsService - referentiel des contacts (module 4, #181).
//
// Meme convention que les autres services : aucun fetch direct, http.js porte
// le Bearer, le refresh sur 401 et la normalisation des erreurs en ApiError
// (message = champ "error" affiche tel quel, code = code_retour, #68) et le
// deballage de l'enveloppe { code, type, libelle, data }.
//
// Le rattachement d'un contact est une FK parmi trois (id_societe, id_editeur,
// id_revendeur), au plus une renseignee. L'API sert type_rattachement
// ('client' | 'editeur' | 'revendeur') et rattachement_label derives : les
// ecrans n'ont pas a resoudre les libelles eux-memes. actif est derive de
// date_fin par l'API, jamais stocke : un contact parti se retire en posant sa
// date de fin, la suppression reste pour la fiche creee par erreur.
//
// La creation et la modification refusent en 409 (codes 5254 et 5255,
// details.existant et details.motif) quand un contact porte deja la meme
// adresse email ou un nom tres proche : l'ecran propose alors d'ouvrir la
// fiche existante, comme pour les revendeurs.
import { http } from './http';

export const contactsService = {
  list:   ()            => http.get('/contacts'),
  get:    (id)          => http.get(`/contacts/${id}`),
  create: (payload)     => http.post('/contacts', payload),
  update: (id, payload) => http.patch(`/contacts/${id}`, payload),
  remove: (id)          => http.delete(`/contacts/${id}`),

  // Referentiel des fonctions (DSI, DAF, acheteur...), pour le selecteur du
  // formulaire. Copy-on-write seede par 003, servi par le routeur contacts.
  fonctions: () => http.get('/fonctions'),

  // Recherche incrementale du formulaire, appelee au fil de la frappe. Reponse
  // pauvre et bornee ({ suggestions, total }), insensible a la casse et aux
  // accents, sur le nom complet dans les deux ordres et l'adresse email.
  // exclure ecarte le contact en cours de modification.
  rechercher: (q, { exclure, limite } = {}) => {
    const params = new URLSearchParams({ q });
    if (exclure) params.set('exclure', exclure);
    if (limite) params.set('limite', String(limite));
    return http.get(`/contacts/recherche?${params.toString()}`);
  },
};
