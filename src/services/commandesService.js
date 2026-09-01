// commandesService - acces API du module commandes.
// Meme convention que contratsService : aucun fetch direct, aucune gestion de
// token, http.js porte le Bearer, le refresh sur 401 et la normalisation des
// erreurs en ApiError (message = champ "error", code = code_retour, #68) et
// le deballage de l'enveloppe { code, type, libelle, data }.
import { http } from './http';

export const commandesService = {
  list:   ()            => http.get('/commandes'),
  get:    (id)          => http.get(`/commandes/${id}`),
  create: (payload)     => http.post('/commandes', payload),
  update: (id, payload) => http.patch(`/commandes/${id}`, payload),
  remove: (id)          => http.delete(`/commandes/${id}`),

  // Les agregats acceptent soit une annee, soit une plage. La societe et
  // l'editeur sont les deux axes du precalcul et se transmettent ; contrat et
  // revendeur n'en sont pas et restent des filtres de liste.
  agregats: ({ dateDebut, dateFin, annee, idSociete, idEditeur } = {}) => {
    const p = new URLSearchParams();
    if (dateDebut && dateFin) { p.set('date_debut', dateDebut); p.set('date_fin', dateFin); }
    else if (annee) p.set('annee', annee);
    if (idSociete) p.set('id_societe', idSociete);
    if (idEditeur) p.set('id_editeur', idEditeur);
    return http.get(`/commandes/agregats?${p.toString()}`);
  },
};

export const modesCommandeService = {
  list: () => http.get('/modes-commande'),
};
