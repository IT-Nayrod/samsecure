// mockBudget - lignes budgetaires CAPEX/OPEX par licence, type et periode
// type 'previsionnel' : preparation a M-4, pre-rempli automatiquement depuis l'historique de maintenance
// type 'alloue' : budget octroye par la direction a M+0, saisi manuellement
// Scenarios 2026 : sous budget (Adobe), depassement (SAP), proche (AutoCAD), CAPEX pur (Windows Server, Oracle)
export const FACTEUR_INFLATION_DEFAUT = 0.035; // TODO: rendre configurable

export const mockBudget = [
  // --- l-pr1-a (Microsoft 365, souscription) : OPEX uniquement, conforme ---
  { id: 'b001', id_licence: 'l-pr1-a',  type: 'previsionnel', montant_CAPEX: 0, montant_OPEX: 16000, date_debut: '2026-01-01', date_fin: '2026-12-31', quantite_CAPEX: 0, quantite_OPEX: 60, date_CAPEX: null },
  { id: 'b002', id_licence: 'l-pr1-a',  type: 'alloue',       montant_CAPEX: 0, montant_OPEX: 15000, date_debut: '2026-01-01', date_fin: '2026-12-31', quantite_CAPEX: 0, quantite_OPEX: 60, date_CAPEX: null },

  // --- l-pr7-a (Adobe Creative Cloud) : scenario "sous budget" (alloue = 73 % du previsionnel) ---
  { id: 'b003', id_licence: 'l-pr7-a',  type: 'previsionnel', montant_CAPEX: 0, montant_OPEX: 30000, date_debut: '2026-01-01', date_fin: '2026-12-31', quantite_CAPEX: 0, quantite_OPEX: 80, date_CAPEX: null },
  { id: 'b004', id_licence: 'l-pr7-a',  type: 'alloue',       montant_CAPEX: 0, montant_OPEX: 22000, date_debut: '2026-01-01', date_fin: '2026-12-31', quantite_CAPEX: 0, quantite_OPEX: 80, date_CAPEX: null },

  // --- l-pr14-a (SAP ERP France) : scenario "depassement budget" (alloue > previsionnel = 129 %) ---
  { id: 'b005', id_licence: 'l-pr14-a', type: 'previsionnel', montant_CAPEX: 0, montant_OPEX: 35000, date_debut: '2026-01-01', date_fin: '2026-12-31', quantite_CAPEX: 0, quantite_OPEX: 80, date_CAPEX: null },
  { id: 'b006', id_licence: 'l-pr14-a', type: 'alloue',       montant_CAPEX: 0, montant_OPEX: 45000, date_debut: '2026-01-01', date_fin: '2026-12-31', quantite_CAPEX: 0, quantite_OPEX: 80, date_CAPEX: null },

  // --- l-pr19-a (AutoCAD) : scenario "proche du budget" (alloue = 82 % du previsionnel) ---
  { id: 'b007', id_licence: 'l-pr19-a', type: 'previsionnel', montant_CAPEX: 0, montant_OPEX: 17000, date_debut: '2026-01-01', date_fin: '2026-12-31', quantite_CAPEX: 0, quantite_OPEX: 30, date_CAPEX: null },
  { id: 'b008', id_licence: 'l-pr19-a', type: 'alloue',       montant_CAPEX: 0, montant_OPEX: 14000, date_debut: '2026-01-01', date_fin: '2026-12-31', quantite_CAPEX: 0, quantite_OPEX: 30, date_CAPEX: null },

  // --- l-pr4-a (Windows Server) : CAPEX uniquement, licence perpetuelle, alloue = 89 % ---
  { id: 'b009', id_licence: 'l-pr4-a',  type: 'previsionnel', montant_CAPEX: 90000, montant_OPEX: 0, date_debut: '2026-01-01', date_fin: '2026-12-31', quantite_CAPEX: 60, quantite_OPEX: 0, date_CAPEX: null },
  { id: 'b010', id_licence: 'l-pr4-a',  type: 'alloue',       montant_CAPEX: 80000, montant_OPEX: 0, date_debut: '2026-01-01', date_fin: '2026-12-31', quantite_CAPEX: 55, quantite_OPEX: 0, date_CAPEX: '2026-03-15' },

  // --- l-pr11-a (Oracle Database) : CAPEX important, proche du previsionnel (alloue = 94 %) ---
  { id: 'b011', id_licence: 'l-pr11-a', type: 'previsionnel', montant_CAPEX: 320000, montant_OPEX: 0, date_debut: '2026-01-01', date_fin: '2026-12-31', quantite_CAPEX: 60, quantite_OPEX: 0, date_CAPEX: null },
  { id: 'b012', id_licence: 'l-pr11-a', type: 'alloue',       montant_CAPEX: 300000, montant_OPEX: 0, date_debut: '2026-01-01', date_fin: '2026-12-31', quantite_CAPEX: 60, quantite_OPEX: 0, date_CAPEX: '2026-06-01' },

  // --- l-pr14-b (SAP ERP - Acme Bordeaux SNC, societe 4 filiale) : OPEX uniquement 2026 ---
  { id: 'b013', id_licence: 'l-pr14-b', type: 'previsionnel', montant_CAPEX: 0, montant_OPEX: 20000, date_debut: '2026-01-01', date_fin: '2026-12-31', quantite_CAPEX: 0, quantite_OPEX: 40, date_CAPEX: null },
  { id: 'b014', id_licence: 'l-pr14-b', type: 'alloue',       montant_CAPEX: 0, montant_OPEX: 18500, date_debut: '2026-01-01', date_fin: '2026-12-31', quantite_CAPEX: 0, quantite_OPEX: 40, date_CAPEX: null },

  // --- Exercice 2025 : historique Adobe et SAP ---
  { id: 'b015', id_licence: 'l-pr7-a',  type: 'previsionnel', montant_CAPEX: 0, montant_OPEX: 50000, date_debut: '2025-01-01', date_fin: '2025-12-31', quantite_CAPEX: 0, quantite_OPEX: 80, date_CAPEX: null },
  { id: 'b016', id_licence: 'l-pr7-a',  type: 'alloue',       montant_CAPEX: 0, montant_OPEX: 48000, date_debut: '2025-01-01', date_fin: '2025-12-31', quantite_CAPEX: 0, quantite_OPEX: 80, date_CAPEX: null },
  { id: 'b017', id_licence: 'l-pr14-a', type: 'previsionnel', montant_CAPEX: 0, montant_OPEX: 38000, date_debut: '2025-01-01', date_fin: '2025-12-31', quantite_CAPEX: 0, quantite_OPEX: 80, date_CAPEX: null },
];

export function getBudgetLignesByPeriod(period) {
  if (!period?.debut || !period?.fin) return mockBudget;
  return mockBudget.filter(b => {
    const bStart = new Date(b.date_debut);
    const bEnd = new Date(b.date_fin);
    return bStart <= period.fin && bEnd >= period.debut;
  });
}

export function getBudgetLignesByLicenceType(idLicence, type, period) {
  return getBudgetLignesByPeriod(period).filter(b => b.id_licence === idLicence && b.type === type);
}
