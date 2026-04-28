// Mock data for SamSecure Dashboard

export const licencesData = [
  { month: 'Jan', value: 1800 },
  { month: 'Feb', value: 1950 },
  { month: 'Mar', value: 2100 },
  { month: 'Apr', value: 2050 },
  { month: 'May', value: 2300 },
  { month: 'Jun', value: 2450 },
  { month: 'Jul', value: 2600 },
  { month: 'Aug', value: 2400 },
  { month: 'Sep', value: 2326 },
  { month: 'Oct', value: 2200 },
  { month: 'Nov', value: 2150 },
  { month: 'Dec', value: 2326 },
];

export const ecartUsageData = [
  { month: 'Jan', value: 120 },
  { month: 'Feb', value: 95 },
  { month: 'Mar', value: 180 },
  { month: 'Apr', value: 60 },
  { month: 'May', value: 140 },
  { month: 'Jun', value: 110 },
  { month: 'Jul', value: 200 },
  { month: 'Aug', value: 280 },
  { month: 'Sep', value: 380 },
  { month: 'Oct', value: 150 },
  { month: 'Nov', value: 130 },
  { month: 'Dec', value: 170 },
];

export const economiesData = {
  value: 141528,
  percentage: 82.9,
  total: 170000,
};

export const topLogiciels = [
  { name: 'M365', amount: 22832, color: '#7C6FCD', percentage: 70 },
  { name: 'Lorem', amount: 20491, color: '#3FC8B8', percentage: 62 },
  { name: 'Lorem', amount: 18915, color: '#52C97A', percentage: 56 },
  { name: 'Lorem', amount: 14178, color: '#F4C842', percentage: 49 },
  { name: 'Lorem', amount: 9988, color: '#E8534A', percentage: 32 },
];

export const conformiteData = {
  score: 50,
  segments: [
    { name: 'Lorem +10', value: 25, color: '#52C97A' },
    { name: 'Lorem +26', value: 30, color: '#F4C842' },
    { name: 'Lorem +3', value: 20, color: '#3FC8B8' },
    { name: 'Lorem +11', value: 25, color: '#7C6FCD' },
  ],
};

export const coutEcartsData = [
  { x: 3, value: 48000 },
  { x: 6, value: 51000 },
  { x: 9, value: 49500 },
  { x: 12, value: 52000 },
  { x: 14, value: 50000 },
  { x: 16, value: 47000 },
];

export const renouvellements = [
  {
    id: 1,
    logiciel: 'Microsoft 365',
    licences: 450,
    expiration: '2026-05-15',
    montant: 22832,
    statut: 'urgent',
  },
  {
    id: 2,
    logiciel: 'Adobe Creative Cloud',
    licences: 120,
    expiration: '2026-06-30',
    montant: 8400,
    statut: 'warning',
  },
  {
    id: 3,
    logiciel: 'Salesforce CRM',
    licences: 80,
    expiration: '2026-07-01',
    montant: 12000,
    statut: 'ok',
  },
  {
    id: 4,
    logiciel: 'Slack Business+',
    licences: 300,
    expiration: '2026-08-20',
    montant: 5400,
    statut: 'ok',
  },
];

export const parcLicences = [
  { id: 1, nom: 'Microsoft 365', editeur: 'Microsoft', licences: 450, utilises: 380, ecart: 70, cout: 22832 },
  { id: 2, nom: 'Adobe CC', editeur: 'Adobe', licences: 120, utilises: 95, ecart: 25, cout: 8400 },
  { id: 3, nom: 'Salesforce', editeur: 'Salesforce', licences: 80, utilises: 78, ecart: 2, cout: 12000 },
  { id: 4, nom: 'Slack', editeur: 'Salesforce', licences: 300, utilises: 265, ecart: 35, cout: 5400 },
  { id: 5, nom: 'Zoom', editeur: 'Zoom', licences: 200, utilises: 160, ecart: 40, cout: 4800 },
  { id: 6, nom: 'GitHub Enterprise', editeur: 'Microsoft', licences: 50, utilises: 48, ecart: 2, cout: 6000 },
];

export const equipeData = [
  { id: 1, nom: 'Sandy Martin', role: 'Admin', email: 'sandy.m@company.com', licences: 12, avatar: 'SM' },
  { id: 2, nom: 'Thomas Dupont', role: 'Manager', email: 'thomas.d@company.com', licences: 8, avatar: 'TD' },
  { id: 3, nom: 'Claire Bernard', role: 'Utilisateur', email: 'claire.b@company.com', licences: 5, avatar: 'CB' },
  { id: 4, nom: 'Marc Leblanc', role: 'Utilisateur', email: 'marc.l@company.com', licences: 4, avatar: 'ML' },
  { id: 5, nom: 'Julie Petit', role: 'Manager', email: 'julie.p@company.com', licences: 7, avatar: 'JP' },
];
