// documentsService - accès API du module documents.
// Unification de l'affichage (#215) : les écrans lisent une seule ressource,
// GET /api/preuves, qui sert toutes les preuves, support de facture compris
// (id_facture et statut de la facture sur la ligne). /api/factures ne sert
// plus qu'au dépôt combiné (POST /factures/depot), à la suppression d'une
// facture avec sa preuve support et à la résolution d'un ancien lien portant
// un identifiant de facture. Même convention que commandesService : aucun fetch direct,
// http.js porte le Bearer, le refresh sur 401 et la normalisation des erreurs
// en ApiError (message = champ "error" affiché tel quel, code = code_retour,
// #68) et le déballage de l'enveloppe { code, type, libelle, data }. Le
// téléchargement de fichier (3206) reste un blob, code en en-tête X-Code-Retour.
import { http } from './http';

// Filtres de GET /preuves : type documentaire, contrat (rattachement direct ou
// par la commande, règle du serveur), commande, licence (#208). Les mêmes
// paramètres restent acceptés par GET /factures pour les clients de l'API.
function query({ idTypePreuve, idContrat, idCommande, idLicence } = {}) {
  const p = new URLSearchParams();
  if (idTypePreuve) p.set('id_type_preuve', idTypePreuve);
  if (idContrat) p.set('id_contrat', idContrat);
  if (idCommande) p.set('id_commande', idCommande);
  if (idLicence) p.set('id_licence', idLicence);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const preuvesService = {
  list:   (filtres)     => http.get(`/preuves${query(filtres)}`),
  get:    (id)          => http.get(`/preuves/${id}`),
  create: (payload)     => http.post('/preuves', payload),
  update: (id, payload) => http.patch(`/preuves/${id}`, payload),
  remove: (id)          => http.delete(`/preuves/${id}`),

  // Dépôt du fichier sur une preuve déjà créée. Le champ doit s'appeler
  // "fichier", c'est le nom attendu par multer côté serveur.
  deposerFichier: (id, file) => {
    const fd = new FormData();
    fd.append('fichier', file);
    return http.postForm(`/preuves/${id}/fichier`, fd);
  },

  // Renvoie un objet URL local à ouvrir dans un onglet. L'appelant doit le
  // libérer avec URL.revokeObjectURL.
  fichierUrl: async (id) => URL.createObjectURL(await http.getBlob(`/preuves/${id}/fichier`)),
};

export const facturesService = {
  list:   (filtres)     => http.get(`/factures${query(filtres)}`),
  get:    (id)          => http.get(`/factures/${id}`),
  update: (id, payload) => http.patch(`/factures/${id}`, payload),
  remove: (id)          => http.delete(`/factures/${id}`),

  // Dépôt combiné : fichier, preuve et facture en une transaction serveur.
  // Il n'existe pas de création de facture sans justificatif dans l'interface,
  // c'est l'arbitrage de flux rendu le 11/08. Le type de la preuve est
  // facultatif depuis la #204 : le serveur applique le type Facture.
  // Depuis le dépôt unifié (#204, 12/09), c'est la modale de preuve qui
  // l'appelle quand le type facture est choisi ; le type est alors transmis.
  // champs : valeurs des champs additionnels définis pour le type
  // (GET /types-preuve/champs), transmises sous leur nom technique, vides
  // omises. Le libellé et la commande passent par leurs paramètres propres.
  deposer: ({ file, label, idCommande, idTypePreuve, labelPreuve, champs }) => {
    const fd = new FormData();
    fd.append('fichier', file);
    fd.append('label', label);
    fd.append('id_commande', idCommande);
    if (idTypePreuve) fd.append('id_type_preuve', idTypePreuve);
    if (labelPreuve) fd.append('label_preuve', labelPreuve);
    for (const [nom, valeur] of Object.entries(champs ?? {})) {
      if (valeur !== '' && valeur !== null && valeur !== undefined && !fd.has(nom)) fd.append(nom, valeur);
    }
    return http.postForm('/factures/depot', fd);
  },
};

export const typesPreuveService = {
  list: () => http.get('/types-preuve'),
  // Définition fusionnée des champs additionnels par type de preuve (#204,
  // migrations 060 et 061) : lignes { code_type_preuve, nom, libelle,
  // type_champ, obligatoire, ordre, origine }, actives seulement, triées.
  champs: () => http.get('/types-preuve/champs'),
};

// Détection des manques : vue temps réel servie par le module commandes, mais
// consommée par l'écran Documents. La réponse est un objet, pas un tableau :
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
