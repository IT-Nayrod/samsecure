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

// Preferences de notification : servies par l'API (GET /notifications/preferences,
// story #121), plus aucune constante ici.
