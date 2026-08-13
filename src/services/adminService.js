// adminService - accès aux ressources d'administration (utilisateurs, groupes,
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

function normalizeAttribution(a) {
  return { id: a.id, id_utilisateur: a.idutilisateur, id_profil: a.idprofil, id_societe: a.idsociete };
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
  // Historique probant d'un compte, lecture seule. La pagination est portee
  // par l'API, 20 evenements par page.
  historique: (id, page = 1) => http.get(`/utilisateurs/${id}/historique?page=${page}`),
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
  listSocietes: (id) =>
    http.get(`/profils/${id}/societes`).then((rows) =>
      rows.map((r) => ({ id: r.id, id_societe: r.idsociete, raison_sociale: r.raisonsociale }))
    ),
  addSociete: (id, id_societe) => http.post(`/profils/${id}/societes`, { id_societe }),
  removeSociete: (id, psId) => http.delete(`/profils/${id}/societes/${psId}`),
  impact: (id) =>
    http.get(`/profils/${id}/impact`).then((r) => ({
      utilisateurs: r.utilisateurs,
      societes: (r.societes || []).map((s) => ({ id: s.id, raison_sociale: s.raisonsociale })),
    })),
  listPermissions: (id) => http.get(`/profils/${id}/permissions`),
  addPermission: (id, id_permission) => http.post(`/profils/${id}/permissions`, { id_permission }),
  removePermission: (id, idPermission) => http.delete(`/profils/${id}/permissions/${idPermission}`),
};

export const permissionsService = {
  list: () => http.get('/permissions'),
};

export const attributionsService = {
  listAll: () => http.get('/attributions').then((rows) => rows.map(normalizeAttribution)),
  listForUser: (userId) =>
    http.get(`/utilisateurs/${userId}/profils`).then((rows) => rows.map(normalizeAttribution)),
  create: (userId, { id_profil, id_societe }) =>
    http.post(`/utilisateurs/${userId}/profils`, { id_profil, id_societe }).then(normalizeAttribution),
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
  orphanGroups: (id) => http.get(`/societes/${id}/profils-orphelins`),
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
