// adminService - accès aux ressources d'administration (utilisateurs, groupés,
// permissions, attributions, exceptions, sociétés, journal). Normalise ici
// l'asymétrie du contrat de la sandbox : lecture en clés aplaties
// (idsociete, raisonsociale...), écriture en snake_case (id_societe...).
import { http } from './http';

function normalizeSociete(s) {
  return {
    id: s.id,
    raison_sociale: s.raisonsociale,
    siret: s.siret,
    email: s.email,
    id_societe_parent: s.idsocieteparent,
    duree_amortissement: s.dureeamortissement,
    revalorisation_annuelle: s.revalorisationannuelle,
    delai_revalidation: s.delairevalidation,
    debut_exercice_fiscal: s.debutexercicefiscal,
    actif: s.actif,
  };
}

// #249 : une attribution de groupe ne porte plus de société (#57), l'API ne
// sert plus idsociete.
function normalizeAttribution(a) {
  return { id: a.id, id_utilisateur: a.idutilisateur, id_profil: a.idprofil };
}

function normalizeException(e) {
  return {
    id: e.id,
    id_utilisateur: e.idutilisateur,
    id_permission: e.idpermission,
    id_societe: e.idsociete,
    type: e.type,
    motif: e.motif,
    date_debut: e.datedebut,
    date_fin: e.datefin,
    motif_modification: e.motif_modification,
  };
}

export const usersService = {
  // GET /utilisateurs sans paramètre : le contrat d'Antonin (sandbox
  // getUtilisateurs()) n'expose aucun filtre côté requête.
  list: () => http.get('/utilisateurs'),
  create: (payload) => http.post('/utilisateurs', payload),
  update: (id, payload) => http.patch(`/utilisateurs/${id}`, payload),
  // Désactivation immédiate d'une sélection (#212). Réponse : { desactives,
  // ignores, ids_desactives, ids_ignores } ; refus 409 si la sélection
  // contient le compte connecté, rien n'est alors écrit.
  desactiverSelection: (ids) => http.post('/utilisateurs/desactivation', { ids }),
  // Historique probant d'un compte, lecture seule. La pagination est portée
  // par l'API, 20 événements par page.
  historique: (id, page = 1) => http.get(`/utilisateurs/${id}/historique?page=${page}`),
  // Trois actions de la story mot de passe. Aucune ne renvoie de hash, et
  // seule la génération renvoie une valeur, une seule fois.
  definirMotDePasse: (id, motDePasse) =>
    http.put(`/utilisateurs/${id}/mot-de-passe`, { mot_de_passe: motDePasse }),
  genererMotDePasse: (id) => http.post(`/utilisateurs/${id}/mot-de-passe/generer`),
  envoyerLienReinitialisation: (id) => http.post(`/utilisateurs/${id}/mot-de-passe/reinitialisation`),
  // Profil par défaut du compte (#249) : un seul, null le retire.
  setProfil: (id, id_profil) => http.put(`/utilisateurs/${id}/profil`, { id_profil }),
  listSocietes: (id) =>
    http.get(`/utilisateurs/${id}/societes`).then((rows) =>
      rows.map((r) => ({ id: r.id, id_utilisateur: r.idutilisateur, id_societe: r.idsociete }))
    ),
  addSociete: (id, id_societe) => http.post(`/utilisateurs/${id}/societes`, { id_societe }),
  removeSociete: (id, societeId) => http.delete(`/utilisateurs/${id}/societes/${societeId}`),
  removeTenantRattachement: (id) => http.delete(`/utilisateurs/${id}/rattachement-tenant`),
};

export const groupsService = {
  list: () => http.get('/profils'),
  get: (id) => http.get(`/profils/${id}`),
  create: (payload) => http.post('/profils', payload),
  update: (id, payload) => http.patch(`/profils/${id}`, payload),
  remove: (id) => http.delete(`/profils/${id}`),
  // #57 : plus de diffusion par société, les routes /profils/:id/societes ont
  // disparu ; l'impact d'une suppression ne porte plus que les utilisateurs.
  impact: (id) =>
    http.get(`/profils/${id}/impact`).then((r) => ({ utilisateurs: r.utilisateurs })),
  // Corbeille des groupes (#64) : supprimés depuis moins de 90 jours, avec
  // jours_restants avant purge ; la restauration réactive droits, diffusions
  // et attributions retirés par la mise en corbeille.
  listCorbeille: () => http.get('/profils/corbeille'),
  restore: (id) => http.post(`/profils/${id}/restaurer`),
  listPermissions: (id) => http.get(`/profils/${id}/permissions`),
  addPermission: (id, id_permission) => http.post(`/profils/${id}/permissions`, { id_permission }),
  removePermission: (id, idPermission) => http.delete(`/profils/${id}/permissions/${idPermission}`),
};

// Paramétrage des profils par défaut (#249), permission gerer_profils :
// matrice par défaut du tenant (remplacement complet, Q2), application en
// masse à des sociétés, sociétés configurées d'un profil.
export const profilsService = {
  remplacerMatrice: (id, permission_ids) => http.put(`/profils/${id}/matrice`, { permission_ids }),
  appliquerMatrice: (id, societe_ids) => http.post(`/profils/${id}/matrice/appliquer`, { societe_ids }),
  societesConfigurees: (id) => http.get(`/profils/${id}/societes-configurees`).then((rows) =>
    rows.map((r) => ({
      id_societe: r.id_societe,
      raison_sociale: r.raison_sociale,
      configure_le: r.configure_le,
      configure_par_label: r.configure_par_label,
    }))
  ),
};

export const permissionsService = {
  list: () => http.get('/permissions'),
};

export const attributionsService = {
  listAll: () => http.get('/attributions').then((rows) => rows.map(normalizeAttribution)),
  listForUser: (userId) =>
    http.get(`/utilisateurs/${userId}/profils`).then((rows) => rows.map(normalizeAttribution)),
  create: (userId, { id_profil }) =>
    http.post(`/utilisateurs/${userId}/profils`, { id_profil }).then(normalizeAttribution),
  remove: (userId, attribId) => http.delete(`/utilisateurs/${userId}/profils/${attribId}`),
};

export const exceptionsService = {
  listAll: () => http.get('/exceptions').then((rows) => rows.map(normalizeException)),
  listForUser: (userId, societeId) =>
    http
      .get(`/utilisateurs/${userId}/exceptions${societeId ? `?societeId=${societeId}` : ''}`)
      .then((rows) => rows.map(normalizeException)),
  create: (userId, payload) =>
    http.post(`/utilisateurs/${userId}/exceptions`, payload).then(normalizeException),
  update: (userId, excId, payload) =>
    http.patch(`/utilisateurs/${userId}/exceptions/${excId}`, payload).then(normalizeException),
  remove: (userId, excId) => http.delete(`/utilisateurs/${userId}/exceptions/${excId}`),
};

export const societesService = {
  list: () => http.get('/societes').then((rows) => rows.map(normalizeSociete)),
  create: (payload) => http.post('/societes', payload).then(normalizeSociete),
  update: (id, payload) => http.patch(`/societes/${id}`, payload).then(normalizeSociete),
  remove: (id) => http.delete(`/societes/${id}`),
  // Onglet Profils de la fiche société (#249, permission gerer_profils).
  profils: (id) => http.get(`/societes/${id}/profils`),
  configurerMatrice: (id, idProfil, permission_ids) =>
    http.put(`/societes/${id}/profils/${idProfil}/matrice`, { permission_ids }),
  revenirAuDefaut: (id, idProfil) => http.delete(`/societes/${id}/profils/${idProfil}/matrice`),
};

export const droitsService = {
  effectifs: (userId, societeId, profilId) => {
    const params = new URLSearchParams({ societeId });
    if (profilId) params.set('profilId', profilId);
    return http.get(`/utilisateurs/${userId}/droits-effectifs?${params.toString()}`);
  },
};

export const journalService = {
  list: ({ search, limit = 200, offset = 0 } = {}) => {
    const params = new URLSearchParams({ limit, offset });
    if (search) params.set('search', search);
    return http.get(`/journal?${params.toString()}`);
  },
};
