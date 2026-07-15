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

// --- FONCTIONS (referentiel commun, lecture seule) -------------------------
export const mockFonctions = [
  { id: 'f1', label: 'DSI' },
  { id: 'f2', label: 'DAF' },
  { id: 'f3', label: 'Acheteur' },
  { id: 'f4', label: 'Responsable technique' },
  { id: 'f5', label: 'Responsable applicatif' },
  { id: 'f6', label: 'Commercial' },
  { id: 'f7', label: 'Support' },
  { id: 'f8', label: 'Autre' },
];

// --- EDITEURS ----------------------------------------------------------------
// logo_slug : nom de fichier dans public/logos/{slug}.svg (Simple Icons). Null si aucun logo fiable trouve (repli initiales).
export const mockEditeurs = [
  { id: 'ed1',  raison_sociale: 'Microsoft Corporation',      pays: 'Etats-Unis',  logo_slug: 'microsoft',        statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed2',  raison_sociale: 'Adobe Systems',               pays: 'Etats-Unis',  logo_slug: 'adobe',            statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed3',  raison_sociale: 'Oracle Corporation',           pays: 'Etats-Unis',  logo_slug: 'oracle',           statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed4',  raison_sociale: 'SAP SE',                       pays: 'Allemagne',   logo_slug: 'sap',              statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed5',  raison_sociale: 'IBM Corporation',              pays: 'Etats-Unis',  logo_slug: 'ibm',              statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed6',  raison_sociale: 'Autodesk',                     pays: 'Etats-Unis',  logo_slug: 'autodesk',         statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed7',  raison_sociale: 'Citrix Systems',                pays: 'Etats-Unis',  logo_slug: 'citrix',           statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed8',  raison_sociale: 'VMware',                       pays: 'Etats-Unis',  logo_slug: 'vmware',           statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed9',  raison_sociale: 'Salesforce',                   pays: 'Etats-Unis',  logo_slug: 'salesforce',       statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed10', raison_sociale: 'ServiceNow',                   pays: 'Etats-Unis',  logo_slug: null,               statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed11', raison_sociale: 'Atlassian',                    pays: 'Australie',   logo_slug: 'atlassian',        statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed12', raison_sociale: 'ESET',                         pays: 'Slovaquie',   logo_slug: null,               statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed13', raison_sociale: 'Symantec (Broadcom)',           pays: 'Etats-Unis',  logo_slug: 'symantec',         statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed14', raison_sociale: 'Dassault Systemes',             pays: 'France',     logo_slug: 'dassaultsystemes', statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed15', raison_sociale: 'Sage',                         pays: 'France',     logo_slug: 'sage',             statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed16', raison_sociale: 'Cegid',                        pays: 'France',     logo_slug: null,               statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed17', raison_sociale: 'Esker',                        pays: 'France',     logo_slug: null,               statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed18', raison_sociale: 'Talend',                       pays: 'France',     logo_slug: 'talend',           statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed19', raison_sociale: 'Slack Technologies',            pays: 'Etats-Unis',  logo_slug: 'slack',            statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'ed20', raison_sociale: 'Zoom Video Communications',     pays: 'Etats-Unis',  logo_slug: 'zoom',             statut_validation: 'en_attente', soumis_par: 'Julie Petit' },
  { id: 'ed21', raison_sociale: 'Datadog',                      pays: 'Etats-Unis',  logo_slug: 'datadog',          statut_validation: 'en_attente', soumis_par: 'Thomas Bernard' },
  { id: 'ed22', raison_sociale: 'Snowflake',                    pays: 'Etats-Unis',  logo_slug: 'snowflake',        statut_validation: 'en_attente', soumis_par: 'Julie Petit' },
  { id: 'ed23', raison_sociale: 'WizzyCorp Solutions',           pays: 'France',     logo_slug: null,               statut_validation: 'refuse',    soumis_par: 'Thomas Bernard', motif_refus: 'Raison sociale introuvable au registre du commerce, a verifier avant nouvelle soumission.' },
  { id: 'ed24', raison_sociale: 'Lansweeper',                   pays: 'Belgique',    logo_slug: null,               statut_validation: 'valide',    soumis_par: 'Import initial' },
];

// --- REVENDEURS ----------------------------------------------------------------
export const mockRevendeurs = [
  { id: 'rv1',  raison_sociale: 'SCC France',                  siret: '33212545600056', iban: 'FR7630006000011234567890189', email: 'contact@scc.fr',         statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'rv2',  raison_sociale: 'Insight Direct',               siret: '40312478900032', iban: 'FR7630004000031234567890143', email: 'contact@insight.com',     statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'rv3',  raison_sociale: 'Bechtle France',               siret: '38456712300048', iban: 'FR7612548029981234567890271', email: 'contact@bechtle.fr',      statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'rv4',  raison_sociale: 'Econocom',                    siret: '38972145600061', iban: 'FR7630003000401234567890370', email: 'contact@econocom.com',    statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'rv5',  raison_sociale: 'Computacenter France',         siret: '34256987100025', iban: 'FR7620041010050500013M02606', email: 'contact@computacenter.fr', statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'rv6',  raison_sociale: 'Softchoice France',            siret: '41258963200017', iban: 'FR7617569000901234567890182', email: 'contact@softchoice.com',  statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'rv7',  raison_sociale: 'CDW France',                   siret: '39845712600039', iban: 'FR7630007000111234567890211', email: 'contact@cdw.com',         statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'rv8',  raison_sociale: 'Crayon France',                 siret: '50123478900014', iban: 'FR7630002005501234567890196', email: 'contact@crayon.com',      statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'rv9',  raison_sociale: 'ALSO France',                  siret: '42698745100052', iban: 'FR7630066100011234567890206', email: 'contact@also.com',        statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'rv10', raison_sociale: 'TD Synnex France',              siret: '35487912600073', iban: 'FR7630001007941234567890138', email: 'contact@tdsynnex.com',    statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'rv11', raison_sociale: 'Dell Technologies France',       siret: '38912456700084', iban: 'FR7630056009501234567890159', email: 'contact@dell.com',        statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'rv12', raison_sociale: 'HPE France',                   siret: '32178945600025', iban: 'FR7630027082001234567890224', email: 'contact@hpe.com',         statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'rv13', raison_sociale: 'Apogea',                       siret: '49856712300041', iban: 'FR7630788001001234567890183', email: 'contact@apogea.fr',       statut_validation: 'en_attente', soumis_par: 'Thomas Bernard' },
  { id: 'rv14', raison_sociale: 'Hardis Group',                  siret: '31254896700019', iban: 'FR7610278024301234567890251', email: 'contact@hardis-group.com', statut_validation: 'en_attente', soumis_par: 'Julie Petit' },
  { id: 'rv15', raison_sociale: 'Devoteam',                     siret: '34896712500066', iban: 'FR7630003020201234567890116', email: 'contact@devoteam.com',    statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'rv16', raison_sociale: 'Inetum',                       siret: '38745961200038', iban: 'FR7610907001011234567890192', email: 'contact@inetum.com',      statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'rv17', raison_sociale: 'Sopra Steria',                  siret: '32692249800012', iban: 'FR7630066100021234567890247', email: 'contact@soprasteria.com', statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'rv18', raison_sociale: 'Cheops Technology',             siret: '40325871900057', iban: 'FR7630004003001234567890278', email: 'contact@cheops.fr',       statut_validation: 'valide',    soumis_par: 'Import initial' },
  { id: 'rv19', raison_sociale: 'Watsoft Distribution',           siret: '49712536800023', iban: 'FR7613807001081234567890163', email: 'contact@watsoft.com',     statut_validation: 'refuse',    soumis_par: 'Thomas Bernard', motif_refus: 'IBAN invalide, format incorrect transmis par le revendeur.' },
  { id: 'rv20', raison_sociale: 'Exclusive Networks',             siret: '49887412300046', iban: 'FR7630003015101234567890294', email: 'contact@exclusive-networks.com', statut_validation: 'valide', soumis_par: 'Import initial' },
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

// --- CONTACTS ------------------------------------------------------------------
// type_rattachement : client | editeur | revendeur
// id_rattachement pointe vers mockSocietes.id, mockEditeurs.id ou mockRevendeurs.id selon le type
export const mockContacts = [
  { id: 'ct1',  nom: 'Lemoine',   prenom: 'Henri',    email: 'h.lemoine@acmegroup.fr',     telephone: '0145789632', id_fonction: 'f1', type_rattachement: 'client',   id_rattachement: '1',  date_debut: '2022-01-10', date_fin: null,         statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'ct2',  nom: 'Garcia',    prenom: 'Lucie',    email: 'l.garcia@acmegroup.fr',      telephone: '0145789633', id_fonction: 'f2', type_rattachement: 'client',   id_rattachement: '1',  date_debut: '2021-03-01', date_fin: null,         statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'ct3',  nom: 'Roussel',   prenom: 'Bastien',  email: 'b.roussel@acmegroup.fr',     telephone: '0478563214', id_fonction: 'f3', type_rattachement: 'client',   id_rattachement: '2',  date_debut: '2023-06-15', date_fin: null,         statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'ct4',  nom: 'Fournier',  prenom: 'Camille',  email: 'c.fournier@acmegroup.fr',    telephone: '0145789635', id_fonction: 'f4', type_rattachement: 'client',   id_rattachement: '1',  date_debut: '2020-09-01', date_fin: null,         statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'ct5',  nom: 'Blanchard', prenom: 'Mathieu',  email: 'm.blanchard@acmegroup.fr',   telephone: '0156784512', id_fonction: 'f5', type_rattachement: 'client',   id_rattachement: '3',  date_debut: '2019-02-01', date_fin: '2025-12-31', statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'ct6',  nom: 'Girard',    prenom: 'Anaelle',  email: 'a.girard@acmegroup.fr',      telephone: '0556784123', id_fonction: 'f3', type_rattachement: 'client',   id_rattachement: '4',  date_debut: '2022-11-01', date_fin: null,         statut_validation: 'en_attente', soumis_par: 'Thomas Bernard' },
  { id: 'ct7',  nom: 'Dupuis',    prenom: 'Nathan',   email: 'nathan.dupuis@microsoft.com', telephone: '0142785632', id_fonction: 'f6', type_rattachement: 'editeur', id_rattachement: 'ed1', date_debut: '2021-01-01', date_fin: null,         statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'ct8',  nom: 'Marchand',  prenom: 'Elodie',   email: 'elodie.marchand@microsoft.com', telephone: '0142785633', id_fonction: 'f7', type_rattachement: 'editeur', id_rattachement: 'ed1', date_debut: '2021-05-01', date_fin: null,         statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'ct9',  nom: 'Perrin',    prenom: 'Romain',   email: 'romain.perrin@adobe.com',     telephone: '0156897412', id_fonction: 'f6', type_rattachement: 'editeur', id_rattachement: 'ed2', date_debut: '2020-08-15', date_fin: null,         statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'ct10', nom: 'Renard',    prenom: 'Sarah',    email: 'sarah.renard@oracle.com',     telephone: '0178945612', id_fonction: 'f6', type_rattachement: 'editeur', id_rattachement: 'ed3', date_debut: '2019-04-01', date_fin: null,         statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'ct11', nom: 'Faure',     prenom: 'Maxime',   email: 'maxime.faure@sap.com',        telephone: '0189562374', id_fonction: 'f7', type_rattachement: 'editeur', id_rattachement: 'ed4', date_debut: '2022-02-01', date_fin: null,         statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'ct12', nom: 'Lambert',   prenom: 'Pauline',  email: 'pauline.lambert@ibm.com',     telephone: '0145632178', id_fonction: 'f6', type_rattachement: 'editeur', id_rattachement: 'ed5', date_debut: '2021-09-01', date_fin: null,         statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'ct13', nom: 'Rolland',   prenom: 'Theo',     email: 'theo.rolland@scc.fr',         telephone: '0147852369', id_fonction: 'f6', type_rattachement: 'revendeur', id_rattachement: 'rv1', date_debut: '2020-01-01', date_fin: null,         statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'ct14', nom: 'Dubois',    prenom: 'Charlotte', email: 'charlotte.dubois@insight.com', telephone: '0148523697', id_fonction: 'f6', type_rattachement: 'revendeur', id_rattachement: 'rv2', date_debut: '2021-07-01', date_fin: null,         statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'ct15', nom: 'Picard',    prenom: 'Hugo',     email: 'hugo.picard@bechtle.fr',      telephone: '0149632587', id_fonction: 'f7', type_rattachement: 'revendeur', id_rattachement: 'rv3', date_debut: '2022-04-01', date_fin: null,         statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'ct16', nom: 'Gauthier',  prenom: 'Manon',    email: 'manon.gauthier@econocom.com',  telephone: '0145789214', id_fonction: 'f6', type_rattachement: 'revendeur', id_rattachement: 'rv4', date_debut: '2020-06-01', date_fin: '2024-12-31', statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'ct17', nom: 'Lacroix',   prenom: 'Antoine',  email: 'antoine.lacroix@computacenter.fr', telephone: '0147896523', id_fonction: 'f6', type_rattachement: 'revendeur', id_rattachement: 'rv5', date_debut: '2023-01-15', date_fin: null,    statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'ct18', nom: 'Vincent',   prenom: 'Julie',    email: 'julie.vincent@acmegroup.fr',  telephone: '0145789652', id_fonction: 'f8', type_rattachement: 'client',   id_rattachement: '2',  date_debut: '2023-03-01', date_fin: null,         statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'ct19', nom: 'Masson',    prenom: 'Quentin',  email: 'quentin.masson@acmegroup.fr', telephone: '0556784512', id_fonction: 'f4', type_rattachement: 'client',   id_rattachement: '4',  date_debut: '2021-10-01', date_fin: null,         statut_validation: 'en_attente', soumis_par: 'Julie Petit' },
  { id: 'ct20', nom: 'Robin',     prenom: 'Ines',     email: 'ines.robin@autodesk.com',     telephone: '0142589632', id_fonction: 'f6', type_rattachement: 'editeur', id_rattachement: 'ed6', date_debut: '2022-05-01', date_fin: null,         statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'ct21', nom: 'Aubert',    prenom: 'Clara',    email: 'clara.aubert@cdw.com',        telephone: '0147896214', id_fonction: 'f7', type_rattachement: 'revendeur', id_rattachement: 'rv7', date_debut: '2023-09-01', date_fin: null,         statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'ct22', nom: 'Gillet',    prenom: 'Yanis',    email: 'yanis.gillet@acmegroup.fr',   telephone: '0145789874', id_fonction: 'f5', type_rattachement: 'client',   id_rattachement: '1',  date_debut: '2018-01-01', date_fin: '2023-06-30', statut_validation: 'valide', soumis_par: 'Import initial' },
];

// mockContratsLies, mockCommandesLiees et mockLicencesLiees deplaces vers data/mockContrats.js et data/mockDeploiement.js

// --- HELPERS DE DERIVATION (comptes utilises par les listes / details / suppression) ---
export function getProduitsByEditeur(idEditeur) {
  return mockProduits.filter(p => p.id_editeur === idEditeur);
}

// getContratsByEditeur deplace vers data/mockContrats.js (source unique)

export function getContactsByRattachement(type, idRattachement) {
  return mockContacts.filter(c => c.type_rattachement === type && c.id_rattachement === idRattachement);
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

export function isContactActif(contact) {
  if (!contact.date_fin) return true;
  return new Date(contact.date_fin) >= new Date();
}

// Resolution du libelle de l'entite de rattachement d'un contact (client, editeur ou revendeur)
export function getRattachementInfo(typeRattachement, idRattachement) {
  if (typeRattachement === 'client') {
    const societe = mockSocietes.find(s => s.id === idRattachement);
    return { label: societe?.raison_sociale ?? 'Societe inconnue', detailPath: `/referentiels/organisation/${idRattachement}` };
  }
  if (typeRattachement === 'editeur') {
    const editeur = mockEditeurs.find(e => e.id === idRattachement);
    return { label: editeur?.raison_sociale ?? 'Editeur inconnu', detailPath: `/referentiels/editeurs/${idRattachement}` };
  }
  if (typeRattachement === 'revendeur') {
    const revendeur = mockRevendeurs.find(r => r.id === idRattachement);
    return { label: revendeur?.raison_sociale ?? 'Revendeur inconnu', detailPath: `/referentiels/revendeurs/${idRattachement}` };
  }
  return { label: 'Inconnu', detailPath: null };
}

// Synthese de conformite agregee par editeur (deterministe a partir de l'id, pas de hasard a chaque rendu)
export function getConformiteEditeur(idEditeur) {
  const seed = idEditeur.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const pct = 55 + (seed % 45);
  if (pct >= 90) return { niveau: 'conforme', label: 'Conforme', pct };
  if (pct >= 75) return { niveau: 'attention', label: 'A surveiller', pct };
  return { niveau: 'non_conforme', label: 'Non conforme', pct };
}
