// mockBudgets - budget saisi par licence, pour un exercice fiscal donne
// exercice : cle = annee d'anniversaire de demarrage de l'exercice fiscal (cf. utils/fiscalPeriod.getExerciceFiscalKey)
// Sert a la page Budget (saisie + budget vs reel) : agregation bottom-up licence -> contrat -> global.
// Scenarios demonstratifs sur l'exercice en cours : c2 (Adobe) sous budget, c6 (AutoCAD) proche du budget,
// c4-1 (SAP ERP France) au-dessus du budget (cf. commande k11 dans mockContrats.js).
export const mockBudgets = [
  { id: 'bg-pr1-a-2025',  id_licence: 'l-pr1-a',  exercice: '2025', montant: 14000 },
  { id: 'bg-pr1-a-2026',  id_licence: 'l-pr1-a',  exercice: '2026', montant: 15500 },
  { id: 'bg-pr1-b-2025',  id_licence: 'l-pr1-b',  exercice: '2025', montant: 11000 },
  { id: 'bg-pr1-b-2026',  id_licence: 'l-pr1-b',  exercice: '2026', montant: 12500 },
  { id: 'bg-pr4-a-2025',  id_licence: 'l-pr4-a',  exercice: '2025', montant: 85000 },
  { id: 'bg-pr4-a-2026',  id_licence: 'l-pr4-a',  exercice: '2026', montant: 92000 },
  { id: 'bg-pr5-a-2025',  id_licence: 'l-pr5-a',  exercice: '2025', montant: 140000 },
  { id: 'bg-pr5-a-2026',  id_licence: 'l-pr5-a',  exercice: '2026', montant: 155000 },
  // l-pr7-a (contrat c2, Adobe) : budget large vs reel realise -> demo "sous budget"
  { id: 'bg-pr7-a-2025',  id_licence: 'l-pr7-a',  exercice: '2025', montant: 50000 },
  { id: 'bg-pr7-a-2026',  id_licence: 'l-pr7-a',  exercice: '2026', montant: 30000 },
  { id: 'bg-pr11-a-2025', id_licence: 'l-pr11-a', exercice: '2025', montant: 290000 },
  { id: 'bg-pr11-a-2026', id_licence: 'l-pr11-a', exercice: '2026', montant: 305000 },
  // l-pr14-a (contrat c4-1, SAP ERP France) : budget insuffisant vs commande k11 -> demo "au-dessus du budget"
  { id: 'bg-pr14-a-2025', id_licence: 'l-pr14-a', exercice: '2025', montant: 150000 },
  { id: 'bg-pr14-a-2026', id_licence: 'l-pr14-a', exercice: '2026', montant: 40000 },
  { id: 'bg-pr14-b-2025', id_licence: 'l-pr14-b', exercice: '2025', montant: 75000 },
  { id: 'bg-pr14-b-2026', id_licence: 'l-pr14-b', exercice: '2026', montant: 82000 },
  { id: 'bg-pr16-a-2025', id_licence: 'l-pr16-a', exercice: '2025', montant: 58000 },
  { id: 'bg-pr16-a-2026', id_licence: 'l-pr16-a', exercice: '2026', montant: 61000 },
  // l-pr19-a (contrat c6, AutoCAD) : budget tres proche du reel realise -> demo "proche du budget"
  { id: 'bg-pr19-a-2025', id_licence: 'l-pr19-a', exercice: '2025', montant: 42000 },
  { id: 'bg-pr19-a-2026', id_licence: 'l-pr19-a', exercice: '2026', montant: 16000 },
];

export function getBudgetsByExercice(exercice) {
  return mockBudgets.filter(b => b.exercice === exercice);
}

export function getBudgetByLicenceExercice(idLicence, exercice) {
  return mockBudgets.find(b => b.id_licence === idLicence && b.exercice === exercice) ?? null;
}

export function getExercicesDisponibles() {
  return [...new Set(mockBudgets.map(b => b.exercice))].sort((a, b) => b.localeCompare(a));
}
