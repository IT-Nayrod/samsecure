// mockSettings - Section 9 Specs UX v0.5
export const mockTenant = {
  raison_sociale: 'Acme Group',
  siret: '42185619600034',
  abonnement: 'Silver',
  admin: 'Sophie Durand',
  // Defaut utilise pour les vues agregeant plusieurs societes (ex. Dashboard global)
  debut_exercice_fiscal: { jour: 1, mois: 1 },
};

// mockSocietes et mockEditeurs deplaces vers data/mockReferentiels.js (source unique)

// mockContrats, mockCommandes et mockFactures deplaces vers data/mockContrats.js (source unique)
// mockLicences et mockAffectations deplaces vers data/mockDeploiement.js (source unique)

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
