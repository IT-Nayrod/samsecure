// adminService - accès aux ressources d'administration (utilisateurs,
// profils, permissions, attributions, exceptions, sociétés, journal).
// Normalise ici l'asymétrie du contrat de la sandbox : lecture en clés
// aplaties (idsociete, raisonsociale...), écriture en snake_case
// (id_societe...).
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
    // #281 : cycle de vie et blocages de suppression. blocages_suppression
    // n'est servi que par la liste (les écritures renvoient la projection
    // sans compteurs) : la fiche recharge la liste après chaque action.
    date_fin_activite: s.datefinactivite,
    blocages_suppression: s.blocages_suppression,
  };
}

// #249/#57 : une attribution ne porte plus de société, l'API ne sert plus
// idsociete.
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

// Profils (#276, tout est profil) : le nom historique groupsService est
// conservé (identifiant technique), les routes servent tous les types de
// profils ; create accepte dashboard_reference (manager_dsi, financier,
// it_ops) qui pose la permission acceder_dashboard_* a la création.
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
  // Profils par défaut du compte (#249 corrigé multi-profils) : remplacement
  // de l'ensemble, liste vide pour tout retirer.
  setProfils: (id, profil_ids) => http.put(`/utilisateurs/${id}/profils`, { profil_ids }),
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
  // Corbeille des profils ajoutés (#64, #276) : supprimés depuis moins de 90
  // jours, avec jours_restants avant purge ; la restauration réactive les
  // droits et attributions retirés par la mise en corbeille.
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

// Attributions unitaires : plus consommées par les écrans depuis le #276 (la
// fiche utilisateur remplace l'ensemble via usersService.setProfils) ;
// conservées en miroir des routes unitaires de l'API, pour tout consommateur
// retardataire.
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
  // #281 : désactivation réversible. La suppression reste remove(), refusée
  // (409) par l'API tant que des objets se raccrochent à la société.
  desactiver: (id) => http.post(`/societes/${id}/desactiver`).then(normalizeSociete),
  reactiver: (id) => http.post(`/societes/${id}/reactiver`).then(normalizeSociete),
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

// Groupes d'organisations (US #277) : sommes de sociétés du tenant, CRUD
// sous gerer_profils. La composition (societe_ids) est remplacée
// intégralement à chaque enregistrement ; la suppression est douce, refusée
// par l'API tant qu'une ligne d'accès s'en sert (409, message tel quel).
export const groupesOrganisationsService = {
  list: () => http.get('/groupes-organisations'),
  get: (id) => http.get(`/groupes-organisations/${id}`),
  create: (payload) => http.post('/groupes-organisations', payload),
  update: (id, payload) => http.put(`/groupes-organisations/${id}`, payload),
  remove: (id) => http.delete(`/groupes-organisations/${id}`),
};

// Groupes d'utilisateurs (US #330) : lectures sous gerer_utilisateurs,
// écritures du groupe et des lignes d'accès (profil × groupe d'organisations)
// sous gerer_profils, membres sous gerer_utilisateurs. Les garde-fous
// (périmètre, délégation #278, admin_sam) sont portés par le serveur, leurs
// refus affichés tels quels.
export const groupesUtilisateursService = {
  list: () => http.get('/groupes-utilisateurs'),
  get: (id) => http.get(`/groupes-utilisateurs/${id}`),
  create: (payload) => http.post('/groupes-utilisateurs', payload),
  update: (id, payload) => http.patch(`/groupes-utilisateurs/${id}`, payload),
  remove: (id) => http.delete(`/groupes-utilisateurs/${id}`),
  addAcces: (id, payload) => http.post(`/groupes-utilisateurs/${id}/acces`, payload),
  removeAcces: (id, accesId) => http.delete(`/groupes-utilisateurs/${id}/acces/${accesId}`),
  addMembre: (id, id_utilisateur) => http.post(`/groupes-utilisateurs/${id}/membres`, { id_utilisateur }),
  removeMembre: (id, membreId) => http.delete(`/groupes-utilisateurs/${id}/membres/${membreId}`),
  // Appartenances d'un compte avec le détail des accès : fiche utilisateur
  // (section Groupes d'utilisateurs) et visionneuse des droits (provenance).
  appartenances: (userId) => http.get(`/utilisateurs/${userId}/groupes-utilisateurs`),
};

export const journalService = {
  list: ({ search, limit = 200, offset = 0 } = {}) => {
    const params = new URLSearchParams({ limit, offset });
    if (search) params.set('search', search);
    return http.get(`/journal?${params.toString()}`);
  },
};
