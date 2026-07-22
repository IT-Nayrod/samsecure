// budgetCalculs - Fonctions pures de calcul KPI budget - SamSecure v0.5
// Extrait de BudgetKPIBar pour reutilisation dans BudgetEmbeddedSection et ailleurs.

export function calcBudgetKpis(lignes) {
  const alloue = lignes.filter(b => b.type === 'alloue');
  const prev   = lignes.filter(b => b.type === 'previsionnel');
  const capex_engage = alloue.reduce((s, b) => s + b.montant_CAPEX, 0);
  const capex_alloue = prev.reduce((s, b) => s + b.montant_CAPEX, 0);
  const opex_engage  = alloue.reduce((s, b) => s + b.montant_OPEX, 0);
  const opex_alloue  = prev.reduce((s, b) => s + b.montant_OPEX, 0);
  return {
    capex_engage,
    capex_alloue,
    ecart_capex: capex_alloue - capex_engage,
    opex_engage,
    opex_alloue,
    ecart_opex: opex_alloue - opex_engage,
  };
}
