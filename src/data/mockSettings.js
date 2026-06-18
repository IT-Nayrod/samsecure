// mockSettings - Section 9 Specs UX v0.5
export const mockTenant = {
  raison_sociale: 'Acme Group',
  siret: '42185619600034',
  abonnement: 'Silver',
  admin: 'Sophie Durand',
};

export const mockSocietes = [
  { id: '1', raison_sociale: 'Acme France SA', siret: '42185619600034', societe_parent_id: null, duree_amortissement: 36, revalorisation: 3.5, delai_revalidation: 30, actif: true },
  { id: '2', raison_sociale: 'Acme Lyon SARL', siret: '53291847200019', societe_parent_id: '1', duree_amortissement: 36, revalorisation: 3.5, delai_revalidation: 30, actif: true },
  { id: '3', raison_sociale: 'Acme Paris SAS', siret: '61234789500027', societe_parent_id: '1', duree_amortissement: 48, revalorisation: 2.0, delai_revalidation: 60, actif: false },
  { id: '4', raison_sociale: 'Acme Bordeaux SNC', siret: '78432156900041', societe_parent_id: '1', duree_amortissement: 36, revalorisation: 3.0, delai_revalidation: 45, actif: true },
];

export const mockEditeurs = [
  { id: 'e1', raison_sociale: 'Microsoft', pays: 'USA' },
  { id: 'e2', raison_sociale: 'Adobe Systems', pays: 'USA' },
  { id: 'e3', raison_sociale: 'Oracle Corporation', pays: 'USA' },
  { id: 'e4', raison_sociale: 'SAP SE', pays: 'Allemagne' },
  { id: 'e5', raison_sociale: 'IBM Corporation', pays: 'USA' },
  { id: 'e6', raison_sociale: 'Citrix Systems', pays: 'USA' },
];

export const mockContrats = [
  { id: 'c1', label: 'Contrat EA Microsoft 2024', editeur: 'Microsoft', type: 'Enterprise Agreement' },
  { id: 'c2', label: 'Adobe Creative Cloud – Acme Group', editeur: 'Adobe Systems', type: 'Subscription' },
  { id: 'c3', label: 'Oracle Database Enterprise License', editeur: 'Oracle Corporation', type: 'Perpétuel' },
  { id: 'c4', label: 'SAP ERP Maintenance & Support', editeur: 'SAP SE', type: 'Maintenance' },
  { id: 'c5', label: 'IBM WebSphere Application Server', editeur: 'IBM Corporation', type: 'Perpétuel' },
];

export const mockLicences = [
  { id: 'l1', produit: 'Microsoft 365 Business Premium', editeur: 'Microsoft' },
  { id: 'l2', produit: 'Adobe Acrobat Pro DC', editeur: 'Adobe Systems' },
  { id: 'l3', produit: 'Oracle Database Enterprise Edition', editeur: 'Oracle Corporation' },
  { id: 'l4', produit: 'SAP ERP Core Component', editeur: 'SAP SE' },
  { id: 'l5', produit: 'Windows Server 2022 Standard', editeur: 'Microsoft' },
  { id: 'l6', produit: 'Adobe Creative Cloud All Apps', editeur: 'Adobe Systems' },
  { id: 'l7', produit: 'Microsoft Intune Device License', editeur: 'Microsoft' },
];

export const NOTIF_PREFS_DEFAULT = {
  contrats_echeance: true,
  commandes_echeance: true,
  licences_depassement: true,
  validations_attente: true,
  saisies_validees: true,
  budget_alerte: true,
  renouvellements: true,
  connecteurs_erreur: false,
  rapports_disponibles: false,
  systeme: false,
};

export const NOTIF_PREFS_LABELS = {
  contrats_echeance: 'Échéances de contrats',
  commandes_echeance: 'Échéances de commandes',
  licences_depassement: 'Dépassements de licences',
  validations_attente: 'Validations en attente',
  saisies_validees: 'Saisies validées ou refusées',
  budget_alerte: 'Alertes budgétaires',
  renouvellements: 'Renouvellements à venir',
  connecteurs_erreur: 'Erreurs de connecteurs',
  rapports_disponibles: 'Rapports disponibles',
  systeme: 'Notifications système',
};
