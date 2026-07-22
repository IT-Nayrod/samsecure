// mockContrats - source unique pour Contrats (echeancier/hierarchie), Commandes (financier)
// et Documents (factures + preuves). Chaine complete et coherente avec mockDeploiement.js :
// chaque licence remonte vers une commande puis un contrat dont l'editeur et la societe correspondent reellement.
import { mockEditeurs, mockSocietes, mockRevendeurs } from './mockReferentiels';

export const mockModesCommande = ['Bon de commande', 'Devis signe', 'Bon de commande EDI', 'Verbal confirme par email'];
export const mockTypesPreuve = ['Bon de livraison', 'Capture ecran portail editeur', 'Attestation editeur', 'Contrat signe scanne', 'Autre'];

// --- CONTRATS ----------------------------------------------------------------
// 2 contrats cadres avec sous-contrats par societe (Microsoft, SAP), pour tester la hierarchie.
// Variete de statuts : actif, proche echeance, a renouveler, expire, perpetuel sans echeance.
export const mockContrats = [
  { id: 'c1',   label: 'Contrat cadre EA Microsoft 2024',          numero: 'CTR-2024-001',   id_editeur: 'ed1', id_societe: '1', id_contrat_parent: null, type: 'cadre',  date_debut: '2024-01-01', date_fin: '2026-12-31', a_renouveler: false, preavis_resiliation_jours: 90, statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'c1-1', label: 'Avenant EA Microsoft - Acme France SA',     numero: 'CTR-2024-001-A', id_editeur: 'ed1', id_societe: '1', id_contrat_parent: 'c1', type: 'simple', date_debut: '2024-01-01', date_fin: '2026-12-31', a_renouveler: false, preavis_resiliation_jours: 90, statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'c1-2', label: 'Avenant EA Microsoft - Acme Lyon SARL',     numero: 'CTR-2024-001-B', id_editeur: 'ed1', id_societe: '2', id_contrat_parent: 'c1', type: 'simple', date_debut: '2024-01-01', date_fin: '2026-08-31', a_renouveler: true,  preavis_resiliation_jours: 90, statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'c2',   label: 'Adobe Creative Cloud - Acme Group',        numero: 'CTR-2023-014',   id_editeur: 'ed2', id_societe: '1', id_contrat_parent: null, type: 'simple', date_debut: '2023-06-01', date_fin: '2026-05-31', a_renouveler: true,  preavis_resiliation_jours: 60, statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'c3',   label: 'Oracle Database Enterprise License',      numero: 'CTR-2022-008',   id_editeur: 'ed3', id_societe: '2', id_contrat_parent: null, type: 'simple', date_debut: '2022-03-15', date_fin: null,         a_renouveler: false, preavis_resiliation_jours: null, statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'c4',   label: 'Contrat cadre SAP ERP Maintenance & Support', numero: 'CTR-2024-027', id_editeur: 'ed4', id_societe: '1', id_contrat_parent: null, type: 'cadre',  date_debut: '2024-04-01', date_fin: '2027-03-31', a_renouveler: false, preavis_resiliation_jours: 90, statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'c4-1', label: 'Avenant SAP ERP - Acme France SA',          numero: 'CTR-2024-027-A', id_editeur: 'ed4', id_societe: '1', id_contrat_parent: 'c4', type: 'simple', date_debut: '2024-04-01', date_fin: '2027-03-31', a_renouveler: false, preavis_resiliation_jours: 90, statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'c4-2', label: 'Avenant SAP ERP - Acme Bordeaux SNC',       numero: 'CTR-2024-027-B', id_editeur: 'ed4', id_societe: '4', id_contrat_parent: 'c4', type: 'simple', date_debut: '2024-04-01', date_fin: '2026-07-15', a_renouveler: true,  preavis_resiliation_jours: 30, statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'c5',   label: 'Contrat cadre IBM Corporation - Infrastructure', numero: 'CTR-2021-019', id_editeur: 'ed5', id_societe: '1', id_contrat_parent: null, type: 'simple', date_debut: '2021-09-01', date_fin: null, a_renouveler: false, preavis_resiliation_jours: null, statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'c6',   label: 'Licences AutoCAD - Acme Paris SAS',         numero: 'CTR-2023-031',   id_editeur: 'ed6', id_societe: '3', id_contrat_parent: null, type: 'simple', date_debut: '2023-01-01', date_fin: '2026-12-31', a_renouveler: true,  preavis_resiliation_jours: 60, statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'c7',   label: 'ESET Endpoint Protection',                  numero: 'CTR-2026-009',   id_editeur: 'ed12', id_societe: '1', id_contrat_parent: null, type: 'simple', date_debut: '2026-06-01', date_fin: '2027-05-31', a_renouveler: false, preavis_resiliation_jours: 60, statut_validation: 'en_attente', soumis_par: 'Thomas Bernard' },
  // Historique Atlassian + Autodesk Revit (2022-2024) - antériorité 3 ans pour les rapports
  { id: 'c8',  label: 'Confluence Cloud - Acme Group',              numero: 'CTR-2022-057',   id_editeur: 'ed11', id_societe: '1', id_contrat_parent: null, type: 'simple', date_debut: '2022-09-01', date_fin: '2025-08-31', a_renouveler: false, preavis_resiliation_jours: 60, statut_validation: 'valide',     soumis_par: 'Import initial' },
  { id: 'c9',  label: 'Jira Cloud - Acme Group',                    numero: 'CTR-2023-011',   id_editeur: 'ed11', id_societe: '1', id_contrat_parent: null, type: 'simple', date_debut: '2023-01-01', date_fin: '2025-12-31', a_renouveler: false, preavis_resiliation_jours: 60, statut_validation: 'valide',     soumis_par: 'Import initial' },
  { id: 'c10', label: 'Revit Architecture 2023 - Acme Paris SAS',   numero: 'CTR-2023-019',   id_editeur: 'ed6',  id_societe: '3', id_contrat_parent: null, type: 'simple', date_debut: '2023-06-01', date_fin: '2026-05-31', a_renouveler: true,  preavis_resiliation_jours: 60, statut_validation: 'valide',     soumis_par: 'Import initial' },
];

// --- COMMANDES -----------------------------------------------------------------
// date_fin : echeance de la souscription pour les commandes a renouveler (null si sans objet)
export const mockCommandes = [
  { id: 'k1-1', label: 'Commande EA Microsoft - Acme France SA',       numero_devis: 'DEV-2024-101', reference_interne: 'CMD-FR-0042', id_contrat: 'c1-1', id_societe: '1', id_revendeur: 'rv1',  mode: 'Bon de commande', montant: 105000, date: '2024-01-15', date_fin: '2026-12-31', a_renouveler: true,  statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'k1-2', label: 'Commande EA Microsoft - Acme Lyon SARL',       numero_devis: 'DEV-2024-102', reference_interne: 'CMD-LY-0042', id_contrat: 'c1-2', id_societe: '2', id_revendeur: 'rv9',  mode: 'Bon de commande', montant: 162000, date: '2024-01-20', date_fin: '2026-08-31', a_renouveler: true,  statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'k2',   label: 'Commande licences Adobe Creative Cloud',        numero_devis: 'DEV-2023-076', reference_interne: 'CMD-FR-0038', id_contrat: 'c2',   id_societe: '1', id_revendeur: 'rv9',  mode: 'Devis signe',     montant: 56000,  date: '2023-06-05', date_fin: '2026-05-31', a_renouveler: true,  statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'k3',   label: 'Commande extension Oracle Database',           numero_devis: 'DEV-2022-054', reference_interne: 'CMD-LY-0011', id_contrat: 'c3',   id_societe: '2', id_revendeur: 'rv3',  mode: 'Bon de commande', montant: 300000, date: '2022-03-20', date_fin: null,         a_renouveler: false, statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'k4-1', label: 'Commande maintenance SAP ERP - Acme France SA', numero_devis: 'DEV-2024-112', reference_interne: 'CMD-FR-0045', id_contrat: 'c4-1', id_societe: '1', id_revendeur: 'rv5',  mode: 'Bon de commande', montant: 160000, date: '2024-04-05', date_fin: '2027-03-31', a_renouveler: true,  statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'k4-2', label: 'Commande maintenance SAP ERP - Acme Bordeaux SNC', numero_devis: 'DEV-2024-113', reference_interne: 'CMD-BX-0046', id_contrat: 'c4-2', id_societe: '4', id_revendeur: 'rv5', mode: 'Bon de commande', montant: 80000, date: '2024-04-10', date_fin: '2026-07-15', a_renouveler: true, statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'k5',   label: 'Commande postes IBM Db2',                      numero_devis: 'DEV-2021-033', reference_interne: 'CMD-FR-0007', id_contrat: 'c5',   id_societe: '1', id_revendeur: 'rv11', mode: 'Bon de commande', montant: 60000,  date: '2021-09-10', date_fin: null,         a_renouveler: false, statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'k6',   label: 'Commande licences AutoCAD',                    numero_devis: 'DEV-2023-014', reference_interne: 'CMD-PA-0009', id_contrat: 'c6',   id_societe: '3', id_revendeur: 'rv15', mode: 'Devis signe',     montant: 45000,  date: '2023-01-10', date_fin: '2026-12-31', a_renouveler: true,  statut_validation: 'valide', soumis_par: 'Import initial' },
  // Commandes recentes (exercices fiscaux 2025 et 2026) : alimentent la timeline Commandes et le budget vs reel
  { id: 'k7',   label: 'Commande postes additionnels EA Microsoft',     numero_devis: 'DEV-2025-021', reference_interne: 'CMD-FR-0051', id_contrat: 'c1-1', id_societe: '1', id_revendeur: 'rv1',  mode: 'Bon de commande', montant: 42000,  date: '2025-03-10', date_fin: null,         a_renouveler: false, statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'k8',   label: 'Commande extension maintenance SAP ERP',        numero_devis: 'DEV-2025-038', reference_interne: 'CMD-FR-0057', id_contrat: 'c4-1', id_societe: '1', id_revendeur: 'rv5',  mode: 'Bon de commande', montant: 38000,  date: '2025-09-05', date_fin: null,         a_renouveler: false, statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'k9',   label: 'Commande postes additionnels Adobe Creative Cloud', numero_devis: 'DEV-2026-006', reference_interne: 'CMD-FR-0063', id_contrat: 'c2', id_societe: '1', id_revendeur: 'rv9', mode: 'Devis signe', montant: 22000, date: '2026-02-20', date_fin: null, a_renouveler: false, statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'k10',  label: 'Commande licences AutoCAD additionnelles',      numero_devis: 'DEV-2026-014', reference_interne: 'CMD-PA-0017', id_contrat: 'c6',   id_societe: '3', id_revendeur: 'rv15', mode: 'Devis signe',     montant: 15000,  date: '2026-05-15', date_fin: null,         a_renouveler: false, statut_validation: 'valide', soumis_par: 'Import initial' },
  // Commande qui depasse le budget de l'exercice en cours (demo budget vs reel)
  { id: 'k11',  label: 'Commande extension postes SAP ERP - depassement budget', numero_devis: 'DEV-2026-019', reference_interne: 'CMD-FR-0068', id_contrat: 'c4-1', id_societe: '1', id_revendeur: 'rv5', mode: 'Bon de commande', montant: 50000, date: '2026-04-01', date_fin: null, a_renouveler: false, statut_validation: 'valide', soumis_par: 'Import initial' },
  // Historique Atlassian + Revit 2022-2024 (k13/k14/k15 sans document - demo R-C05 commandes sans facture)
  { id: 'k12',  label: 'Commande Confluence Cloud 2022',              numero_devis: 'DEV-2022-081', reference_interne: 'CMD-FR-0031', id_contrat: 'c8',  id_societe: '1', id_revendeur: 'rv9',  mode: 'Devis signe',     montant: 12000, date: '2022-09-10', date_fin: '2025-08-31', a_renouveler: false, statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'k13',  label: 'Commande Jira Cloud 2023',                    numero_devis: 'DEV-2023-008', reference_interne: 'CMD-FR-0034', id_contrat: 'c9',  id_societe: '1', id_revendeur: 'rv9',  mode: 'Devis signe',     montant:  9600, date: '2023-01-05', date_fin: '2025-12-31', a_renouveler: false, statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'k14',  label: 'Renouvellement Jira Cloud 2024',              numero_devis: 'DEV-2024-009', reference_interne: 'CMD-FR-0048', id_contrat: 'c9',  id_societe: '1', id_revendeur: 'rv9',  mode: 'Devis signe',     montant: 10000, date: '2024-01-08', date_fin: '2025-12-31', a_renouveler: false, statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'k15',  label: 'Commande Revit Architecture 2023',            numero_devis: 'DEV-2023-022', reference_interne: 'CMD-PA-0012', id_contrat: 'c10', id_societe: '3', id_revendeur: 'rv15', mode: 'Devis signe',     montant: 18000, date: '2023-06-05', date_fin: '2026-05-31', a_renouveler: true,  statut_validation: 'valide', soumis_par: 'Import initial' },
];

// --- DOCUMENTS (factures + preuves unifiees) -------------------------------------
// k1-2 et k4-1 : facture sans preuve. k4-2 : aucun document du tout (manque complet, demo audit).
export const mockDocuments = [
  { id: 'doc1',  type: 'facture', label: 'Facture EA Microsoft 2024 - France SA',       type_preuve: null, id_commande: 'k1-1', id_contrat: null, nom_fichier: 'facture_ea_microsoft_france_2024.pdf', date: '2024-01-20', statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'doc2',  type: 'preuve',  label: 'BL EA Microsoft - France SA',                 type_preuve: 'Bon de livraison', id_commande: 'k1-1', id_contrat: null, nom_fichier: 'bl_ea_microsoft_france.pdf', date: '2024-01-22', statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'doc3',  type: 'facture', label: 'Facture EA Microsoft 2024 - Lyon SARL',       type_preuve: null, id_commande: 'k1-2', id_contrat: null, nom_fichier: 'facture_ea_microsoft_lyon_2024.pdf', date: '2024-01-25', statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'doc4',  type: 'facture', label: 'Facture Adobe Creative Cloud annuelle',        type_preuve: null, id_commande: 'k2', id_contrat: null, nom_fichier: 'facture_adobe_cc_2023.pdf', date: '2023-06-10', statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'doc5',  type: 'preuve',  label: 'Attestation Adobe Creative Cloud',            type_preuve: 'Attestation editeur', id_commande: 'k2', id_contrat: null, nom_fichier: 'attestation_adobe_cc.pdf', date: '2023-06-12', statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'doc6',  type: 'facture', label: 'Facture extension Oracle Database',           type_preuve: null, id_commande: 'k3', id_contrat: null, nom_fichier: 'facture_oracle_db_2022.pdf', date: '2022-03-25', statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'doc7',  type: 'preuve',  label: 'BL Oracle Database',                          type_preuve: 'Bon de livraison', id_commande: 'k3', id_contrat: null, nom_fichier: 'bl_oracle_db.pdf', date: '2022-03-28', statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'doc8',  type: 'facture', label: 'Facture maintenance SAP ERP - annee 1',        type_preuve: null, id_commande: 'k4-1', id_contrat: null, nom_fichier: 'facture_sap_erp_france_an1.pdf', date: '2024-04-10', statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'doc9',  type: 'facture', label: 'Facture postes IBM Db2',                      type_preuve: null, id_commande: 'k5', id_contrat: null, nom_fichier: 'facture_ibm_db2.pdf', date: '2021-09-15', statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'doc10', type: 'preuve',  label: 'BL postes IBM Db2',                            type_preuve: 'Bon de livraison', id_commande: 'k5', id_contrat: null, nom_fichier: 'bl_ibm_db2.pdf', date: '2021-09-18', statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'doc11', type: 'facture', label: 'Facture licences AutoCAD',                    type_preuve: null, id_commande: 'k6', id_contrat: null, nom_fichier: 'facture_autocad_paris.pdf', date: '2023-01-15', statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'doc12', type: 'preuve',  label: 'Capture portail Autodesk - AutoCAD',           type_preuve: 'Capture ecran portail editeur', id_commande: 'k6', id_contrat: null, nom_fichier: 'capture_autodesk_portal.png', date: '2023-01-16', statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'doc13', type: 'preuve',  label: 'Contrat EA Microsoft signe',                  type_preuve: 'Contrat signe scanne', id_commande: null, id_contrat: 'c1', nom_fichier: 'contrat_ea_microsoft_signe.pdf', date: '2024-01-05', statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'doc14', type: 'facture', label: 'Facture postes additionnels EA Microsoft',    type_preuve: null, id_commande: 'k7', id_contrat: null, nom_fichier: 'facture_ea_microsoft_2025_extension.pdf', date: '2025-03-15', statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'doc15', type: 'facture', label: 'Facture extension maintenance SAP ERP',        type_preuve: null, id_commande: 'k8', id_contrat: null, nom_fichier: 'facture_sap_erp_2025_extension.pdf', date: '2025-09-10', statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'doc16', type: 'facture', label: 'Facture postes additionnels Adobe Creative Cloud', type_preuve: null, id_commande: 'k9', id_contrat: null, nom_fichier: 'facture_adobe_cc_2026_extension.pdf', date: '2026-02-25', statut_validation: 'valide', soumis_par: 'Import initial' },
  { id: 'doc17', type: 'facture', label: 'Facture extension postes SAP ERP - depassement',  type_preuve: null, id_commande: 'k11', id_contrat: null, nom_fichier: 'facture_sap_erp_2026_extension.pdf', date: '2026-04-05', statut_validation: 'valide', soumis_par: 'Import initial' },
  // doc18 : Confluence a une facture ; k13/k14 (Jira) et k15 (Revit) n'ont aucun document (demo R-C05)
  { id: 'doc18', type: 'facture', label: 'Facture Confluence Cloud 2022',                   type_preuve: null, id_commande: 'k12', id_contrat: null, nom_fichier: 'facture_confluence_cloud_2022.pdf',  date: '2022-09-15', statut_validation: 'valide', soumis_par: 'Import initial' },
];

// --- HELPERS DE DERIVATION --------------------------------------------------------
export function getContrat(idContrat) {
  return mockContrats.find(c => c.id === idContrat) ?? null;
}

export function getCommande(idCommande) {
  return mockCommandes.find(c => c.id === idCommande) ?? null;
}

export function getSousContrats(idContrat) {
  return mockContrats.filter(c => c.id_contrat_parent === idContrat);
}

export function getCommandesByContrat(idContrat) {
  return mockCommandes.filter(k => k.id_contrat === idContrat);
}

export function getDocumentsByCommande(idCommande) {
  return mockDocuments.filter(d => d.id_commande === idCommande);
}

export function getDocumentsByContrat(idContrat) {
  return mockDocuments.filter(d => d.id_contrat === idContrat);
}

// Tous les documents lies a un contrat : directement, ou via une de ses commandes
export function getTousDocumentsContrat(idContrat) {
  const directs = getDocumentsByContrat(idContrat);
  const viaCommandes = getCommandesByContrat(idContrat).flatMap(k => getDocumentsByCommande(k.id));
  return [...directs, ...viaCommandes];
}

export function getContratsByEditeur(idEditeur) {
  return mockContrats.filter(c => c.id_editeur === idEditeur);
}

export function getContratsBySociete(idSociete) {
  return mockContrats.filter(c => c.id_societe === idSociete);
}

export function getCommandesByRevendeur(idRevendeur) {
  return mockCommandes.filter(k => k.id_revendeur === idRevendeur);
}

export function getCommandesBySociete(idSociete) {
  return mockCommandes.filter(k => k.id_societe === idSociete);
}

// Statut d'echeance d'un contrat : expire / a_renouveler / actif, avec jours restants si une date de fin existe
export function getEcheanceContrat(contrat, today = new Date()) {
  if (!contrat.date_fin) return { statut: 'actif', joursRestants: null };
  const fin = new Date(contrat.date_fin);
  const joursRestants = Math.round((fin - today) / 86400000);
  if (joursRestants < 0) return { statut: 'expire', joursRestants };
  if (contrat.a_renouveler || joursRestants <= 90) return { statut: 'a_renouveler', joursRestants };
  return { statut: 'actif', joursRestants };
}

// Statut d'echeance d'une commande a renouveler (meme principe que les contrats)
export function getEcheanceCommande(commande, today = new Date()) {
  if (!commande.date_fin) return { statut: 'actif', joursRestants: null };
  const fin = new Date(commande.date_fin);
  const joursRestants = Math.round((fin - today) / 86400000);
  if (joursRestants < 0) return { statut: 'expire', joursRestants };
  if (commande.a_renouveler || joursRestants <= 90) return { statut: 'a_renouveler', joursRestants };
  return { statut: 'actif', joursRestants };
}

// Manques documentaires (audit) : commandes sans facture et / ou sans preuve.
// Accepte la liste de documents en cours (etat local de la page) pour refleter les ajouts recents.
export function getManquesAudit(documents = mockDocuments) {
  return mockCommandes.map(k => {
    const docs = documents.filter(d => d.id_commande === k.id);
    return {
      commande: k,
      sansFacture: !docs.some(d => d.type === 'facture'),
      sansPreuve: !docs.some(d => d.type === 'preuve'),
    };
  }).filter(m => m.sansFacture || m.sansPreuve);
}

export function getEditeurLabel(idEditeur) {
  return mockEditeurs.find(e => e.id === idEditeur)?.raison_sociale ?? null;
}

export function getSocieteLabelContrat(idSociete) {
  return mockSocietes.find(s => s.id === idSociete)?.raison_sociale ?? null;
}

export function getRevendeurLabelCommande(idRevendeur) {
  return mockRevendeurs.find(r => r.id === idRevendeur)?.raison_sociale ?? null;
}
