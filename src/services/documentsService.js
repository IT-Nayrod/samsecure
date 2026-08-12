// documentsService - acces API du module documents.
// Deux ressources distinctes, fidelement au schema : /api/preuves et
// /api/factures. Le front les assemble pour l'ecran unifie, il ne fusionne pas
// les modeles. Meme convention que commandesService : aucun fetch direct,
// http.js porte le Bearer, le refresh sur 401 et la normalisation des erreurs
// en ApiError dont le message est le champ "error" du serveur, affiche tel quel.
import { http } from './http';

// Les trois filtres sont communs aux deux ressources, pour que l'ecran unifie
// applique un seul jeu de filtres a ses deux sources. Cote factures, contrat et
// type de preuve passent par les jointures : l'API s'en charge.
function query({ idTypePreuve, idContrat, idCommande } = {}) {
  const p = new URLSearchParams();
  if (idTypePreuve) p.set('id_type_preuve', idTypePreuve);
  if (idContrat) p.set('id_contrat', idContrat);
  if (idCommande) p.set('id_commande', idCommande);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const preuvesService = {
  list:   (filtres)     => http.get(`/preuves${query(filtres)}`),
  get:    (id)          => http.get(`/preuves/${id}`),
  create: (payload)     => http.post('/preuves', payload),
  update: (id, payload) => http.patch(`/preuves/${id}`, payload),
  remove: (id)          => http.delete(`/preuves/${id}`),

  // Depot du fichier sur une preuve deja creee. Le champ doit s'appeler
  // "fichier", c'est le nom attendu par multer cote serveur.
  deposerFichier: (id, file) => {
    const fd = new FormData();
    fd.append('fichier', file);
    return http.postForm(`/preuves/${id}/fichier`, fd);
  },

  // Renvoie un objet URL local a ouvrir dans un onglet. L'appelant doit le
  // liberer avec URL.revokeObjectURL.
  fichierUrl: async (id) => URL.createObjectURL(await http.getBlob(`/preuves/${id}/fichier`)),
};

export const facturesService = {
  list:   (filtres)     => http.get(`/factures${query(filtres)}`),
  get:    (id)          => http.get(`/factures/${id}`),
  update: (id, payload) => http.patch(`/factures/${id}`, payload),
  remove: (id)          => http.delete(`/factures/${id}`),

  // Depot combine : fichier, preuve et facture en une transaction serveur.
  // Il n'existe pas de creation de facture sans justificatif dans l'interface,
  // c'est l'arbitrage de flux rendu le 11/08.
  deposer: ({ file, label, idCommande, idTypePreuve, labelPreuve }) => {
    const fd = new FormData();
    fd.append('fichier', file);
    fd.append('label', label);
    fd.append('id_commande', idCommande);
    fd.append('id_type_preuve', idTypePreuve);
    if (labelPreuve) fd.append('label_preuve', labelPreuve);
    return http.postForm('/factures/depot', fd);
  },
};

export const typesPreuveService = {
  list: () => http.get('/types-preuve'),
};

// Detection des manques : vue temps reel servie par le module commandes, mais
// consommee par l'ecran Documents. La reponse est un objet, pas un tableau :
// { filtres, total, total_sans_facture, total_sans_preuve, commandes }.
export const manquesService = {
  list: ({ idSociete, idContrat, annee } = {}) => {
    const p = new URLSearchParams();
    if (idSociete) p.set('id_societe', idSociete);
    if (idContrat) p.set('id_contrat', idContrat);
    if (annee) p.set('annee', annee);
    const s = p.toString();
    return http.get(`/commandes/manques${s ? `?${s}` : ''}`);
  },
};
