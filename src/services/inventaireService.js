// inventaireService - acces API du module inventaire (#111).
// Meme convention que documentsService : aucun fetch direct, http.js porte le
// Bearer, le refresh sur 401, la normalisation des erreurs en ApiError
// (message = champ "error", code = code_retour 4200-4299) et le deballage de
// l'enveloppe { code, type, libelle, data }.
//
// Doctrine actee : l'outil constate et alerte, il ne cree ni ne modifie jamais
// une affectation. Les quatre transitions ci-dessous ne touchent que le releve.
import { http } from './http';

function query(filtres = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filtres)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const inventaireService = {
  // Import manuel d'un fichier csv de releve. Le champ doit s'appeler
  // "fichier", nom attendu par multer cote serveur. id_societe optionnel :
  // societe par defaut des lignes sans colonne societe.
  importer: ({ file, idSociete }) => {
    const fd = new FormData();
    fd.append('fichier', file);
    if (idSociete) fd.append('id_societe', idSociete);
    return http.postForm('/inventaire/imports', fd);
  },
  listImports: ()   => http.get('/inventaire/imports'),
  getImport:   (id) => http.get(`/inventaire/imports/${id}`),

  // filtres : { statut, id_societe, id_affectation, id_import }
  listReleves: (filtres) => http.get(`/inventaire/releves${query(filtres)}`),
  getReleve:   (id)      => http.get(`/inventaire/releves/${id}`),

  // { compteurs, constates_sans_affectation, affectations_non_constatees, synthese_produits }
  ecarts: () => http.get('/inventaire/ecarts'),

  // Affectations existantes, pour le choix manuel du rapprochement.
  listAffectations: () => http.get('/inventaire/affectations'),

  rapprocher:  (id, idAffectation) => http.post(`/inventaire/releves/${id}/rapprocher`, { id_affectation: idAffectation }),
  ecartAssume: (id, motif)         => http.post(`/inventaire/releves/${id}/ecart-assume`, { motif }),
  rejeter:     (id, motif)         => http.post(`/inventaire/releves/${id}/rejeter`, { motif }),
  reouvrir:    (id)                => http.post(`/inventaire/releves/${id}/reouvrir`, {}),
};

// Route d'administration non enveloppee : liste nue { id, raison_sociale }.
export const societesInventaireService = {
  list: () => http.get('/societes'),
};

export const RAPPROCHEMENT_STATUT = {
  en_attente:    { variant: 'neutral', label: 'En attente' },
  rapproche:     { variant: 'success', label: 'Rapproché' },
  ecart_detecte: { variant: 'warning', label: 'Écart détecté' },
  rejete:        { variant: 'neutral', label: 'Rejeté' },
};

export const IMPORT_STATUT = {
  en_cours:       { variant: 'neutral', label: 'En cours' },
  succes:         { variant: 'success', label: 'Succès' },
  succes_partiel: { variant: 'warning', label: 'Succès partiel' },
  echec:          { variant: 'error',   label: 'Échec' },
};
