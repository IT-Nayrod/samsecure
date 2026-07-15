// mockDeploiement - source unique pour Licences (droits), Affectations (declare) et Inventaire (reel)
// Triangle de conformite : remplace les anciens stubs relationnels de mockReferentiels.js
// (mockLicencesLiees, mockAffectationsParSociete) et les listes pauvres de mockSettings.js
// (mockLicences, mockAffectations), qui n'alimentaient que la recherche globale.
import { mockProduits, mockSocietes, mockRevendeurs } from './mockReferentiels';
import { mockContrats, mockCommandes } from './mockContrats';

// --- LICENCES (droits acquis) ----------------------------------------------------
// 8 produits mis en scene : conforme, attention, depassement, ecart declare/reel,
// maintenance active, maintenance arretee / version figee.
// id_contrat / id_commande pointent vers des entrees de mockContrats.js dont l'editeur
// et la societe correspondent reellement (chaine contrat -> commande -> licence navigable).
export const mockLicences = [
  { id: 'l-pr1-a',  id_produit: 'pr1',  id_edition: 'e1',  id_version: 'v1',  id_contrat: 'c1-1', id_commande: 'k1-1', id_revendeur: 'rv1',  id_societe: '1', type: 'souscription', unite_mesure: 'utilisateur', quantite: 60, cout: 15000, version_figee_id: null, date_arret_maintenance: null },
  { id: 'l-pr1-b',  id_produit: 'pr1',  id_edition: 'e2',  id_version: 'v1',  id_contrat: 'c1-2', id_commande: 'k1-2', id_revendeur: 'rv9',  id_societe: '2', type: 'souscription', unite_mesure: 'utilisateur', quantite: 40, cout: 12000, version_figee_id: null, date_arret_maintenance: null },
  { id: 'l-pr4-a',  id_produit: 'pr4',  id_edition: 'e3',  id_version: 'v3',  id_contrat: 'c1-1', id_commande: 'k1-1', id_revendeur: 'rv1',  id_societe: '1', type: 'perpetuelle',   unite_mesure: 'device',     quantite: 60, cout: 90000, version_figee_id: null, date_arret_maintenance: null },
  { id: 'l-pr5-a',  id_produit: 'pr5',  id_edition: 'e6',  id_version: 'v5',  id_contrat: 'c1-2', id_commande: 'k1-2', id_revendeur: 'rv1',  id_societe: '2', type: 'perpetuelle',   unite_mesure: 'coeur',      quantite: 50, cout: 150000, version_figee_id: null, date_arret_maintenance: null },
  { id: 'l-pr7-a',  id_produit: 'pr7',  id_edition: null,  id_version: 'v7',  id_contrat: 'c2',   id_commande: 'k2',   id_revendeur: 'rv9',  id_societe: '1', type: 'souscription', unite_mesure: 'utilisateur', quantite: 80, cout: 56000, version_figee_id: null, date_arret_maintenance: null },
  { id: 'l-pr11-a', id_produit: 'pr11', id_edition: 'e9',  id_version: 'v10', id_contrat: 'c3',   id_commande: 'k3',   id_revendeur: 'rv3',  id_societe: '2', type: 'perpetuelle',   unite_mesure: 'instance',   quantite: 60, cout: 300000, version_figee_id: null, date_arret_maintenance: null },
  { id: 'l-pr14-a', id_produit: 'pr14', id_edition: 'e12', id_version: 'v13', id_contrat: 'c4-1', id_commande: 'k4-1', id_revendeur: 'rv5',  id_societe: '1', type: 'souscription', unite_mesure: 'utilisateur', quantite: 80, cout: 160000, version_figee_id: null, date_arret_maintenance: null },
  { id: 'l-pr14-b', id_produit: 'pr14', id_edition: 'e10', id_version: 'v13', id_contrat: 'c4-2', id_commande: 'k4-2', id_revendeur: 'rv5',  id_societe: '4', type: 'souscription', unite_mesure: 'utilisateur', quantite: 40, cout: 80000, version_figee_id: null, date_arret_maintenance: null },
  { id: 'l-pr16-a', id_produit: 'pr16', id_edition: null,  id_version: 'v16', id_contrat: 'c5',   id_commande: 'k5',   id_revendeur: 'rv11', id_societe: '1', type: 'perpetuelle',   unite_mesure: 'instance',   quantite: 40, cout: 60000, version_figee_id: 'v16', date_arret_maintenance: '2024-06-30' },
  { id: 'l-pr19-a', id_produit: 'pr19', id_edition: null,  id_version: 'v14', id_contrat: 'c6',   id_commande: 'k6',   id_revendeur: 'rv15', id_societe: '3', type: 'souscription', unite_mesure: 'utilisateur', quantite: 30, cout: 45000, version_figee_id: null, date_arret_maintenance: null },
  // Licences Atlassian et Revit (taux d'utilisation faible -> R-O01 licences dormantes)
  { id: 'l-pr22-a', id_produit: 'pr22', id_edition: null, id_version: null, id_contrat: 'c8',  id_commande: 'k12', id_revendeur: 'rv9',  id_societe: '1', type: 'souscription', unite_mesure: 'utilisateur', quantite: 100, cout: 12000, version_figee_id: null, date_arret_maintenance: null },
  { id: 'l-pr21-a', id_produit: 'pr21', id_edition: null, id_version: null, id_contrat: 'c9',  id_commande: 'k13', id_revendeur: 'rv9',  id_societe: '1', type: 'souscription', unite_mesure: 'utilisateur', quantite:  80, cout:  9600, version_figee_id: null, date_arret_maintenance: null },
  { id: 'l-pr20-a', id_produit: 'pr20', id_edition: null, id_version: null, id_contrat: 'c10', id_commande: 'k15', id_revendeur: 'rv15', id_societe: '3', type: 'souscription', unite_mesure: 'utilisateur', quantite:  25, cout: 18000, version_figee_id: null, date_arret_maintenance: null },
];

export const mockMaintenanceHistorique = [
  { id: 'mh1', id_licence: 'l-pr1-a',  date_debut: '2023-01-01', date_fin: '2026-12-31', cout: 6000,  prestataire: 'Microsoft Corporation' },
  { id: 'mh2', id_licence: 'l-pr14-a', date_debut: '2024-04-01', date_fin: '2027-03-31', cout: 12000, prestataire: 'SAP SE' },
  { id: 'mh3', id_licence: 'l-pr16-a', date_debut: '2021-09-01', date_fin: '2024-06-30', cout: 8000,  prestataire: 'IBM Corporation' },
  // Maintenance licences dormantes Atlassian + Revit (R-O02 : maintenance payee, usage nul ou negligeable)
  { id: 'mh4', id_licence: 'l-pr22-a', date_debut: '2022-09-01', date_fin: '2025-08-31', cout: 3000, prestataire: 'Atlassian' },
  { id: 'mh5', id_licence: 'l-pr21-a', date_debut: '2023-01-01', date_fin: '2025-12-31', cout: 2400, prestataire: 'Atlassian' },
  { id: 'mh6', id_licence: 'l-pr20-a', date_debut: '2023-06-01', date_fin: '2026-05-31', cout: 4500, prestataire: 'Autodesk' },
];

// --- AFFECTATIONS (usage declare) ------------------------------------------------
export const mockAffectations = [
  { id: 'af-pr1-a',  id_produit: 'pr1',  id_societe: '1', quantite: 50, reference_client: 'M365 - S. Durand',         statut_validation: 'valide',    soumis_par: 'Thomas Bernard', date_derniere_revalidation: '2026-06-01' },
  { id: 'af-pr1-b',  id_produit: 'pr1',  id_societe: '2', quantite: 35, reference_client: 'M365 - Pool Lyon',         statut_validation: 'en_attente', soumis_par: 'Thomas Bernard', date_derniere_revalidation: null },
  { id: 'af-pr4-a',  id_produit: 'pr4',  id_societe: '1', quantite: 50, reference_client: 'WinSrv - Cluster Prod',    statut_validation: 'valide',    soumis_par: 'Thomas Bernard', date_derniere_revalidation: '2025-12-01' },
  { id: 'af-pr5-a',  id_produit: 'pr5',  id_societe: '2', quantite: 30, reference_client: 'SQL - Instance Lyon 1',    statut_validation: 'valide',    soumis_par: 'Julie Petit',    date_derniere_revalidation: '2026-06-01' },
  { id: 'af-pr5-b',  id_produit: 'pr5',  id_societe: '2', quantite: 17, reference_client: 'SQL - Instance Lyon 2',    statut_validation: 'valide',    soumis_par: 'Julie Petit',    date_derniere_revalidation: '2026-05-25' },
  { id: 'af-pr7-a',  id_produit: 'pr7',  id_societe: '1', quantite: 60, reference_client: 'Adobe CC - Studio Design', statut_validation: 'valide',    soumis_par: 'Thomas Bernard', date_derniere_revalidation: '2026-06-10' },
  { id: 'af-pr11-a', id_produit: 'pr11', id_societe: '2', quantite: 68, reference_client: 'Oracle DB - Cluster Lyon', statut_validation: 'valide',    soumis_par: 'Julie Petit',    date_derniere_revalidation: '2026-01-15' },
  { id: 'af-pr14-a', id_produit: 'pr14', id_societe: '1', quantite: 80, reference_client: 'SAP ERP - Siege',          statut_validation: 'valide',    soumis_par: 'Thomas Bernard', date_derniere_revalidation: '2026-06-15' },
  { id: 'af-pr14-b', id_produit: 'pr14', id_societe: '4', quantite: 20, reference_client: 'SAP ERP - Bordeaux',       statut_validation: 'en_attente', soumis_par: 'Julie Petit',    date_derniere_revalidation: null },
  { id: 'af-pr16-a', id_produit: 'pr16', id_societe: '1', quantite: 22, reference_client: 'IBM Db2 - Entrepot donnees', statut_validation: 'valide',  soumis_par: 'Thomas Bernard', date_derniere_revalidation: '2026-03-01' },
  { id: 'af-pr19-a', id_produit: 'pr19', id_societe: '3', quantite: 29, reference_client: 'AutoCAD - Bureau etudes',    statut_validation: 'valide',    soumis_par: 'Julie Petit',    date_derniere_revalidation: '2026-05-01' },
  // Affectations Atlassian (dormantes : 12% et 22% de taux utilisation -> R-O01)
  { id: 'af-pr22-a', id_produit: 'pr22', id_societe: '1', quantite: 12, reference_client: 'Confluence - Equipe DSI',    statut_validation: 'valide',    soumis_par: 'Thomas Bernard', date_derniere_revalidation: '2026-03-15' },
  { id: 'af-pr21-a', id_produit: 'pr21', id_societe: '1', quantite: 18, reference_client: 'Jira - Equipe projets',       statut_validation: 'valide',    soumis_par: 'Thomas Bernard', date_derniere_revalidation: '2025-12-01' },
  // Historique 2023-2024 pour R-C04 (etat des revalidations avec anteriorite 3 ans)
  { id: 'af-pr1-c',  id_produit: 'pr1',  id_societe: '1', quantite: 48, reference_client: 'M365 - Historique 2023',     statut_validation: 'valide',    soumis_par: 'Thomas Bernard', date_derniere_revalidation: '2023-06-10' },
  { id: 'af-pr4-b',  id_produit: 'pr4',  id_societe: '1', quantite: 44, reference_client: 'WinSrv - Historique 2024',  statut_validation: 'valide',    soumis_par: 'Thomas Bernard', date_derniere_revalidation: '2024-01-20' },
];

// --- INVENTAIRE (usage reel detecte) ---------------------------------------------
export const mockConnecteurs = [
  { id: 'cn1', nom: 'Lansweeper',         statut: 'ok' },
  { id: 'cn2', nom: 'GLPI',               statut: 'ok' },
  { id: 'cn3', nom: 'Active Directory',   statut: 'ok' },
  { id: 'cn4', nom: 'SCCM',               statut: 'defaillant' },
  { id: 'cn5', nom: 'Intune',             statut: 'non_configure' },
  { id: 'cn6', nom: 'Ivanti',             statut: 'non_configure' },
];

export const mockInventaireRaw = [
  { id: 'inv-pr1-a',  id_produit: 'pr1',  id_societe: '1', connecteur: 'Lansweeper',       format_source: 'JSON', url_fichier: '/inventaire/2026-06-15/lansweeper_acme-france.json', quantite_detectee: 50, date_collecte: '2026-06-15', statut_rapprochement: 'rapproche',     id_affectation: 'af-pr1-a',  nature_ecart: null },
  { id: 'inv-pr1-b',  id_produit: 'pr1',  id_societe: '2', connecteur: 'Active Directory', format_source: 'CSV',  url_fichier: '/inventaire/2026-06-15/ad_acme-lyon.csv',             quantite_detectee: 35, date_collecte: '2026-06-15', statut_rapprochement: 'rapproche',     id_affectation: 'af-pr1-b',  nature_ecart: null },
  { id: 'inv-pr4-a',  id_produit: 'pr4',  id_societe: '1', connecteur: 'SCCM',             format_source: 'JSON', url_fichier: '/inventaire/2026-06-10/sccm_acme-france.json',        quantite_detectee: 50, date_collecte: '2026-06-10', statut_rapprochement: 'rapproche',     id_affectation: 'af-pr4-a',  nature_ecart: null },
  { id: 'inv-pr5-a',  id_produit: 'pr5',  id_societe: '2', connecteur: 'GLPI',             format_source: 'JSON', url_fichier: '/inventaire/2026-06-12/glpi_acme-lyon.json',          quantite_detectee: 30, date_collecte: '2026-06-12', statut_rapprochement: 'rapproche',     id_affectation: 'af-pr5-a',  nature_ecart: null },
  { id: 'inv-pr5-b',  id_produit: 'pr5',  id_societe: '2', connecteur: 'GLPI',             format_source: 'JSON', url_fichier: '/inventaire/2026-06-12/glpi_acme-lyon.json',          quantite_detectee: 17, date_collecte: '2026-06-12', statut_rapprochement: 'rapproche',     id_affectation: 'af-pr5-b',  nature_ecart: null },
  { id: 'inv-pr7-a',  id_produit: 'pr7',  id_societe: '1', connecteur: 'Intune',           format_source: 'JSON', url_fichier: '/inventaire/2026-06-16/intune_acme-france.json',      quantite_detectee: 60, date_collecte: '2026-06-16', statut_rapprochement: 'rapproche',     id_affectation: 'af-pr7-a',  nature_ecart: null },
  { id: 'inv-pr7-b',  id_produit: 'pr7',  id_societe: '1', connecteur: 'Intune',           format_source: 'JSON', url_fichier: '/inventaire/2026-06-16/intune_acme-france.json',      quantite_detectee: 14, date_collecte: '2026-06-16', statut_rapprochement: 'ecart_detecte', id_affectation: null,        nature_ecart: 'Usage detecte non declare : 14 postes Adobe Creative Cloud actifs sans affectation correspondante' },
  { id: 'inv-pr11-a', id_produit: 'pr11', id_societe: '2', connecteur: 'Active Directory', format_source: 'CSV',  url_fichier: '/inventaire/2026-06-14/ad_acme-lyon.csv',             quantite_detectee: 68, date_collecte: '2026-06-14', statut_rapprochement: 'rapproche',     id_affectation: 'af-pr11-a', nature_ecart: null },
  { id: 'inv-pr14-a', id_produit: 'pr14', id_societe: '1', connecteur: 'SCCM',             format_source: 'JSON', url_fichier: '/inventaire/2026-06-15/sccm_acme-france.json',        quantite_detectee: 80, date_collecte: '2026-06-15', statut_rapprochement: 'rapproche',     id_affectation: 'af-pr14-a', nature_ecart: null },
  { id: 'inv-pr14-b', id_produit: 'pr14', id_societe: '4', connecteur: 'SCCM',             format_source: 'JSON', url_fichier: '/inventaire/2026-06-15/sccm_acme-bordeaux.json',      quantite_detectee: 20, date_collecte: '2026-06-15', statut_rapprochement: 'en_attente',    id_affectation: null,        nature_ecart: null },
  { id: 'inv-pr16-a', id_produit: 'pr16', id_societe: '1', connecteur: 'Lansweeper',       format_source: 'JSON', url_fichier: '/inventaire/2026-06-11/lansweeper_acme-france.json', quantite_detectee: 22, date_collecte: '2026-06-11', statut_rapprochement: 'rapproche',     id_affectation: 'af-pr16-a', nature_ecart: null },
  { id: 'inv-pr19-a', id_produit: 'pr19', id_societe: '3', connecteur: 'GLPI',             format_source: 'JSON', url_fichier: '/inventaire/2026-06-09/glpi_acme-paris.json',         quantite_detectee: 29, date_collecte: '2026-06-09', statut_rapprochement: 'rapproche',     id_affectation: 'af-pr19-a', nature_ecart: null },
  { id: 'inv-noise-1', id_produit: 'pr1', id_societe: '2', connecteur: 'Active Directory', format_source: 'CSV',  url_fichier: '/inventaire/2026-06-15/ad_acme-lyon.csv',             quantite_detectee: 5,  date_collecte: '2026-06-15', statut_rapprochement: 'rejete',        id_affectation: null,        nature_ecart: 'Doublon avec inv-pr1-b, ecarte apres verification' },
];

// --- HELPERS DE DERIVATION --------------------------------------------------------
export function getLicencesByProduit(idProduit) {
  return mockLicences.filter(l => l.id_produit === idProduit);
}

export function getLicencesByRevendeur(idRevendeur) {
  return mockLicences.filter(l => l.id_revendeur === idRevendeur);
}

export function getLicencesByContrat(idContrat) {
  return mockLicences.filter(l => l.id_contrat === idContrat);
}

export function getLicencesByCommande(idCommande) {
  return mockLicences.filter(l => l.id_commande === idCommande);
}

export function getMaintenanceHistorique(idLicence) {
  return mockMaintenanceHistorique.filter(m => m.id_licence === idLicence);
}

export function getAffectationsByProduit(idProduit) {
  return mockAffectations.filter(a => a.id_produit === idProduit);
}

export function getAffectationsBySociete(idSociete) {
  return mockAffectations.filter(a => a.id_societe === idSociete);
}

export function getInventaireByProduit(idProduit) {
  return mockInventaireRaw.filter(i => i.id_produit === idProduit);
}

export function getDroitsTotalProduit(idProduit) {
  return getLicencesByProduit(idProduit).reduce((s, l) => s + l.quantite, 0);
}

// Seules les affectations validees comptent pour la conformite officielle
export function getDeclareTotalProduit(idProduit) {
  return mockAffectations.filter(a => a.id_produit === idProduit && a.statut_validation === 'valide').reduce((s, a) => s + a.quantite, 0);
}

// Les entrees rejetees ne comptent pas dans l'usage reel
export function getReelTotalProduit(idProduit) {
  return mockInventaireRaw.filter(i => i.id_produit === idProduit && i.statut_rapprochement !== 'rejete').reduce((s, i) => s + i.quantite_detectee, 0);
}

export function getNiveauConformite(ratio) {
  if (ratio > 1) return 'depassement';
  if (ratio >= 0.9) return 'attention';
  return 'conforme';
}

// Triangle complet pour un produit : droits vs declare (officiel) vs reel detecte
export function getTriangleProduit(idProduit) {
  const droits = getDroitsTotalProduit(idProduit);
  const declare = getDeclareTotalProduit(idProduit);
  const reel = getReelTotalProduit(idProduit);
  const ratioDeclare = droits > 0 ? declare / droits : 0;
  const ratioReel = droits > 0 ? reel / droits : 0;
  return {
    droits, declare, reel, ratioDeclare, ratioReel,
    niveauDeclare: getNiveauConformite(ratioDeclare),
    niveauReel: getNiveauConformite(ratioReel),
    ecartDeclareReel: reel - declare,
  };
}

export function getRevalidationStatut(affectation, today = new Date()) {
  if (!affectation.date_derniere_revalidation) return null;
  const societe = mockSocietes.find(s => s.id === affectation.id_societe);
  const delai = societe?.delai_revalidation ?? 30;
  const derniere = new Date(affectation.date_derniere_revalidation);
  const prochaine = new Date(derniere);
  prochaine.setDate(prochaine.getDate() + delai);
  const joursRestants = Math.round((prochaine - today) / 86400000);
  let statut = 'a_jour';
  if (joursRestants < 0) statut = 'depasse';
  else if (joursRestants <= 15) statut = 'a_revalider';
  return { prochaine: prochaine.toISOString().slice(0, 10), joursRestants, statut };
}

export function getContratLabel(idContrat) {
  return mockContrats.find(c => c.id === idContrat)?.label ?? null;
}

export function getCommandeLabel(idCommande) {
  return mockCommandes.find(c => c.id === idCommande)?.label ?? null;
}

export function getRevendeurLabel(idRevendeur) {
  return mockRevendeurs.find(r => r.id === idRevendeur)?.raison_sociale ?? null;
}

export function getProduitsAvecLicence() {
  const ids = new Set(mockLicences.map(l => l.id_produit));
  return mockProduits.filter(p => ids.has(p.id));
}
