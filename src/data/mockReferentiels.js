// V1 - Mocks Referentiels (Clients, Editeurs, Revendeurs, Contacts, Logiciels) - section Referentiels
// Source unique pour les editeurs et les societes (remplace les anciens exports de mockSettings.js)

// --- CLIENTS / SOCIETES --------------------------------------------------------
// Hierarchie : Acme France SA (mere) -> filiales -> sous-filiale (pour tester 2 niveaux)
// debut_exercice_fiscal : { jour, mois } - jour/mois de demarrage de l'exercice fiscal de la societe
export const mockSocietes = [
  { id: '1', raison_sociale: 'Acme France SA',     siret: '42185619600034', societe_parent_id: null, duree_amortissement: 36, revalorisation: 3.5, delai_revalidation: 30, actif: true,  statut_validation: 'valide', soumis_par: 'Import initial', debut_exercice_fiscal: { jour: 1, mois: 1 } },
  { id: '2', raison_sociale: 'Acme Lyon SARL',      siret: '53291847200019', societe_parent_id: '1',  duree_amortissement: 36, revalorisation: 3.5, delai_revalidation: 30, actif: true,  statut_validation: 'valide', soumis_par: 'Import initial', debut_exercice_fiscal: { jour: 1, mois: 4 } },
  { id: '3', raison_sociale: 'Acme Paris SAS',      siret: '61234789500027', societe_parent_id: '1',  duree_amortissement: 48, revalorisation: 2.0, delai_revalidation: 60, actif: false, statut_validation: 'valide', soumis_par: 'Import initial', debut_exercice_fiscal: { jour: 1, mois: 1 } },
  { id: '4', raison_sociale: 'Acme Bordeaux SNC',   siret: '78432156900041', societe_parent_id: '1',  duree_amortissement: 36, revalorisation: 3.0, delai_revalidation: 45, actif: true,  statut_validation: 'valide', soumis_par: 'Import initial', debut_exercice_fiscal: { jour: 1, mois: 7 } },
  { id: '5', raison_sociale: 'Acme Lyon Distribution', siret: '53291847200043', societe_parent_id: '2', duree_amortissement: 24, revalorisation: 3.5, delai_revalidation: 30, actif: true, statut_validation: 'en_attente', soumis_par: 'Thomas Bernard', debut_exercice_fiscal: { jour: 1, mois: 4 } },
  { id: '6', raison_sociale: 'Acme Marseille SARL', siret: '44567812300052', societe_parent_id: '1',  duree_amortissement: 36, revalorisation: 2.8, delai_revalidation: 30, actif: true,  statut_validation: 'en_attente', soumis_par: 'Julie Petit', debut_exercice_fiscal: { jour: 1, mois: 1 } },
];

export function getFilialesBySociete(idSociete) {
  return mockSocietes.filter(s => s.societe_parent_id === idSociete);
}

// getAffectationsBySociete deplace vers data/mockDeploiement.js (source unique des affectations)
// getContratsBySociete et getCommandesBySociete deplaces vers data/mockContrats.js (source unique)

// --- EDITEURS ----------------------------------------------------------------
// logo_slug : nom de fichier dans public/logos/{slug}.svg (Simple Icons). Null si aucun logo fiable trouve (repli initiales).
export const mockEditeurs = [
  { id: 'ed1',  raison_sociale: 'Microsoft Corporation',      pays: 'États-Unis',  logo_slug: 'microsoft',        statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed2',  raison_sociale: 'Adobe Systems',               pays: 'États-Unis',  logo_slug: 'adobe',            statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed3',  raison_sociale: 'Oracle Corporation',           pays: 'États-Unis',  logo_slug: 'oracle',           statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed4',  raison_sociale: 'SAP SE',                       pays: 'Allemagne',   logo_slug: 'sap',              statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed5',  raison_sociale: 'IBM Corporation',              pays: 'États-Unis',  logo_slug: 'ibm',              statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed6',  raison_sociale: 'Autodesk',                     pays: 'États-Unis',  logo_slug: 'autodesk',         statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed7',  raison_sociale: 'Citrix Systems',                pays: 'États-Unis',  logo_slug: 'citrix',           statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed8',  raison_sociale: 'VMware',                       pays: 'États-Unis',  logo_slug: 'vmware',           statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed9',  raison_sociale: 'Salesforce',                   pays: 'États-Unis',  logo_slug: 'salesforce',       statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed10', raison_sociale: 'ServiceNow',                   pays: 'États-Unis',  logo_slug: null,               statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed11', raison_sociale: 'Atlassian',                    pays: 'Australie',   logo_slug: 'atlassian',        statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed12', raison_sociale: 'ESET',                         pays: 'Slovaquie',   logo_slug: null,               statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed13', raison_sociale: 'Symantec (Broadcom)',           pays: 'États-Unis',  logo_slug: 'symantec',         statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed14', raison_sociale: 'Dassault Systemes',             pays: 'France',     logo_slug: 'dassaultsystemes', statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed15', raison_sociale: 'Sage',                         pays: 'France',     logo_slug: 'sage',             statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed16', raison_sociale: 'Cegid',                        pays: 'France',     logo_slug: null,               statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed17', raison_sociale: 'Esker',                        pays: 'France',     logo_slug: null,               statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed18', raison_sociale: 'Talend',                       pays: 'France',     logo_slug: 'talend',           statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed19', raison_sociale: 'Slack Technologies',            pays: 'États-Unis',  logo_slug: 'slack',            statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed20', raison_sociale: 'Zoom Video Communications',     pays: 'États-Unis',  logo_slug: 'zoom',             statut_validation: 'en_attente', soumis_par: 'Julie Petit' },
  { id: 'ed21', raison_sociale: 'Datadog',                      pays: 'États-Unis',  logo_slug: 'datadog',          statut_validation: 'en_attente', soumis_par: 'Thomas Bernard' },
  { id: 'ed22', raison_sociale: 'Snowflake',                    pays: 'États-Unis',  logo_slug: 'snowflake',        statut_validation: 'en_attente', soumis_par: 'Julie Petit' },
  { id: 'ed23', raison_sociale: 'WizzyCorp Solutions',           pays: 'France',     logo_slug: null,               statut_validation: 'refuse',    soumis_par: 'Thomas Bernard', motif_refus: 'Raison sociale introuvable au registre du commerce, à vérifier avant nouvelle soumission.' },
  { id: 'ed24', raison_sociale: 'Lansweeper',                   pays: 'Belgique',    logo_slug: null,               statut_validation: 'valide',    soumis_par: 'Import initial' },
];

// --- PRODUITS (catalogue commun + produits client) ---------------------------
// Hierarchie : suites (parent) -> sous-produits (enfants)
export const mockProduits = [
  // Microsoft
  { id: 'pr1',  label: 'Microsoft 365',            id_editeur: 'ed1', sku: 'MS365-E3',     id_produit_parent: null,  a_maintenir: true,  source: 'catalogue' },
  { id: 'pr2',  label: 'Exchange Online',          id_editeur: 'ed1', sku: 'MS365-EXO',    id_produit_parent: 'pr1', a_maintenir: true,  source: 'catalogue' },
  { id: 'pr3',  label: 'Microsoft Teams',          id_editeur: 'ed1', sku: 'MS365-TEAMS',  id_produit_parent: 'pr1', a_maintenir: true,  source: 'catalogue' },
  { id: 'pr4',  label: 'Windows Server',           id_editeur: 'ed1', sku: 'WINSRV-STD',   id_produit_parent: null,  a_maintenir: true,  source: 'catalogue' },
  { id: 'pr5',  label: 'SQL Server',               id_editeur: 'ed1', sku: 'SQLSRV',       id_produit_parent: null,  a_maintenir: true,  source: 'catalogue' },
  { id: 'pr6',  label: 'Azure',                    id_editeur: 'ed1', sku: 'AZURE-CONSO',  id_produit_parent: null,  a_maintenir: false, source: 'catalogue' },
  // Adobe
  { id: 'pr7',  label: 'Adobe Creative Cloud',      id_editeur: 'ed2', sku: 'ACC-ALLAPPS',  id_produit_parent: null,  a_maintenir: true,  source: 'catalogue' },
  { id: 'pr8',  label: 'Photoshop',                id_editeur: 'ed2', sku: 'ACC-PS',       id_produit_parent: 'pr7', a_maintenir: true,  source: 'catalogue' },
  { id: 'pr9',  label: 'Illustrator',              id_editeur: 'ed2', sku: 'ACC-AI',       id_produit_parent: 'pr7', a_maintenir: true,  source: 'catalogue' },
  { id: 'pr10', label: 'Adobe Acrobat',             id_editeur: 'ed2', sku: 'ACRO-PRO-DC',  id_produit_parent: null,  a_maintenir: true,  source: 'catalogue' },
  // Oracle
  { id: 'pr11', label: 'Oracle Database',           id_editeur: 'ed3', sku: 'ORADB-EE',     id_produit_parent: null,  a_maintenir: true,  source: 'catalogue' },
  { id: 'pr12', label: 'Oracle Middleware',         id_editeur: 'ed3', sku: 'ORA-MW',       id_produit_parent: null,  a_maintenir: true,  source: 'catalogue' },
  { id: 'pr13', label: 'Oracle Java SE',            id_editeur: 'ed3', sku: 'ORA-JSE',      id_produit_parent: null,  a_maintenir: false, source: 'catalogue' },
  // SAP
  { id: 'pr14', label: 'SAP ERP',                  id_editeur: 'ed4', sku: 'SAP-ERP-CC',   id_produit_parent: null,  a_maintenir: true,  source: 'catalogue' },
  { id: 'pr15', label: 'SAP BusinessObjects',        id_editeur: 'ed4', sku: 'SAP-BO',       id_produit_parent: null,  a_maintenir: true,  source: 'catalogue' },
  // IBM
  { id: 'pr16', label: 'IBM Db2',                  id_editeur: 'ed5', sku: 'IBM-DB2',      id_produit_parent: null,  a_maintenir: true,  source: 'catalogue' },
  { id: 'pr17', label: 'IBM MQ',                   id_editeur: 'ed5', sku: 'IBM-MQ',       id_produit_parent: null,  a_maintenir: true,  source: 'catalogue' },
  { id: 'pr18', label: 'IBM WebSphere',             id_editeur: 'ed5', sku: 'IBM-WS',       id_produit_parent: null,  a_maintenir: true,  source: 'catalogue' },
  // Autodesk
  { id: 'pr19', label: 'AutoCAD',                  id_editeur: 'ed6', sku: 'ACAD',         id_produit_parent: null,  a_maintenir: true,  source: 'catalogue' },
  { id: 'pr20', label: 'Revit',                    id_editeur: 'ed6', sku: 'REVIT',        id_produit_parent: null,  a_maintenir: true,  source: 'catalogue' },
  // Atlassian
  { id: 'pr21', label: 'Jira',                     id_editeur: 'ed11', sku: 'JIRA-CLOUD',   id_produit_parent: null,  a_maintenir: false, source: 'catalogue' },
  { id: 'pr22', label: 'Confluence',                id_editeur: 'ed11', sku: 'CONF-CLOUD',   id_produit_parent: null,  a_maintenir: false, source: 'catalogue' },
  // Citrix / VMware
  { id: 'pr23', label: 'Citrix Virtual Apps and Desktops', id_editeur: 'ed7', sku: 'CTX-VAD', id_produit_parent: null, a_maintenir: true, source: 'catalogue' },
  { id: 'pr24', label: 'VMware vSphere',            id_editeur: 'ed8', sku: 'VMW-VSPH',     id_produit_parent: null,  a_maintenir: true,  source: 'catalogue' },
  // Produits client (custom, editables par le tenant)
  { id: 'pc1',  label: 'Outil de paie interne Acme', id_editeur: null,  sku: null, id_produit_parent: null, a_maintenir: false, source: 'client', statut_validation: 'valide',    soumis_par: 'Sophie Durand' },
  { id: 'pc2',  label: 'Portail RH Acme Lyon',       id_editeur: null,  sku: null, id_produit_parent: null, a_maintenir: true,  source: 'client', statut_validation: 'en_attente', soumis_par: 'Thomas Bernard' },
  { id: 'pc3',  label: 'Connecteur EDI fournisseurs', id_editeur: null,  sku: null, id_produit_parent: null, a_maintenir: false, source: 'client', statut_validation: 'en_attente', soumis_par: 'Julie Petit' },
];

export const mockVersions = [
  { id: 'v1', id_produit: 'pr1',  label: '2024' },
  { id: 'v2', id_produit: 'pr1',  label: '2021' },
  { id: 'v3', id_produit: 'pr4',  label: '2022' },
  { id: 'v4', id_produit: 'pr4',  label: '2019' },
  { id: 'v5', id_produit: 'pr5',  label: '2022' },
  { id: 'v6', id_produit: 'pr5',  label: '2019' },
  { id: 'v7', id_produit: 'pr7',  label: '2024' },
  { id: 'v8', id_produit: 'pr10', label: 'DC' },
  { id: 'v9', id_produit: 'pr11', label: '19c' },
  { id: 'v10', id_produit: 'pr11', label: '21c' },
  { id: 'v11', id_produit: 'pr13', label: '17' },
  { id: 'v12', id_produit: 'pr13', label: '21' },
  { id: 'v13', id_produit: 'pr14', label: '6.0 EHP8' },
  { id: 'v14', id_produit: 'pr19', label: '2024' },
  { id: 'v15', id_produit: 'pr19', label: '2023' },
  { id: 'v16', id_produit: 'pr16', label: '11.5' },
];

export const mockEditions = [
  { id: 'e1',  id_produit: 'pr1',  label: 'E3' },
  { id: 'e2',  id_produit: 'pr1',  label: 'E5' },
  { id: 'e3',  id_produit: 'pr4',  label: 'Standard' },
  { id: 'e4',  id_produit: 'pr4',  label: 'Datacenter' },
  { id: 'e5',  id_produit: 'pr5',  label: 'Express' },
  { id: 'e6',  id_produit: 'pr5',  label: 'Standard' },
  { id: 'e7',  id_produit: 'pr5',  label: 'Enterprise' },
  { id: 'e8',  id_produit: 'pr11', label: 'Standard' },
  { id: 'e9',  id_produit: 'pr11', label: 'Enterprise' },
  { id: 'e10', id_produit: 'pr14', label: 'Standard' },
  { id: 'e11', id_produit: 'pr14', label: 'Professional' },
  { id: 'e12', id_produit: 'pr14', label: 'Enterprise' },
];

// mockContratsLies, mockCommandesLiees et mockLicencesLiees deplaces vers data/mockContrats.js et data/mockDeploiement.js

// --- HELPERS DE DERIVATION (comptes utilises par les listes / details / suppression) ---
export function getProduitsByEditeur(idEditeur) {
  return mockProduits.filter(p => p.id_editeur === idEditeur);
}

// getCommandesByRevendeur deplace vers data/mockContrats.js (source unique)

export function getVersionsByProduit(idProduit) {
  return mockVersions.filter(v => v.id_produit === idProduit);
}

export function getEditionsByProduit(idProduit) {
  return mockEditions.filter(e => e.id_produit === idProduit);
}

export function getSousProduits(idProduitParent) {
  return mockProduits.filter(p => p.id_produit_parent === idProduitParent);
}

// Synthese de conformite agregee par editeur (deterministe a partir de l'id, pas de hasard a chaque rendu)
export function getConformiteEditeur(idEditeur) {
  const seed = idEditeur.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const pct = 55 + (seed % 45);
  if (pct >= 90) return { niveau: 'conforme', label: 'Conforme', pct };
  if (pct >= 75) return { niveau: 'attention', label: 'À surveiller', pct };
  return { niveau: 'non_conforme', label: 'Non conforme', pct };
}
