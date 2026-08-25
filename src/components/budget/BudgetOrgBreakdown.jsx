// BudgetOrgBreakdown - Repartition du budget par organisation - SamSecure v0.5
// Une ligne par societe du perimetre, alimentee par la synthese de l'API
// filtree sur cette societe (BudgetPage fait un appel par societe). Affiche
// uniquement quand plus d'une societe porte du budget ou de l'engage.
// Clic sur une ligne = drill-down via onSelectSociete(id).
import { useMemo } from 'react';
import { formatEuros, formatPourcentage, cumulerTotaux, totauxVides } from './budgetCalculs';

const TH_CLS = 'px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap';

function EcartCell({ valeur }) {
  const pos = (valeur ?? 0) >= 0;
  return (
    <td className={`px-3 py-2 text-right text-sm font-medium ${pos ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {pos ? '+' : ''}{formatEuros(valeur)}
    </td>
  );
}

// lignes : [{ societe: { id, raison_sociale, depth }, totaux }] dans l'ordre hierarchique
export default function BudgetOrgBreakdown({ lignes = [], onSelectSociete }) {
  const rows = useMemo(() => lignes.filter(r => !totauxVides(r.totaux)), [lignes]);
  const total = useMemo(() => cumulerTotaux(rows.map(r => r.totaux)), [rows]);

  if (rows.length <= 1) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Répartition par organisation</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Cliquez sur une ligne pour filtrer sur cette organisation</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
              <th className={`${TH_CLS} text-left`}>Organisation</th>
              <th className={`${TH_CLS} text-right`}>Prévisionnel CAPEX</th>
              <th className={`${TH_CLS} text-right`}>Prévisionnel OPEX</th>
              <th className={`${TH_CLS} text-right`}>Alloué CAPEX</th>
              <th className={`${TH_CLS} text-right`}>Alloué OPEX</th>
              <th className={`${TH_CLS} text-right`}>Engagé</th>
              <th className={`${TH_CLS} text-right`}>Écart alloué / engagé</th>
              <th className={`${TH_CLS} text-right`}>Taux</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const depth = r.societe.depth ?? 0;
              const t = r.totaux ?? {};
              return (
                <tr
                  key={r.societe.id}
                  onClick={() => onSelectSociete?.(r.societe.id)}
                  className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                    {depth > 0 && <span className="text-gray-400 mr-1">&#8627;</span>}
                    <span style={depth > 0 ? { paddingLeft: `${(depth - 1) * 12}px` } : undefined}>{r.societe.raison_sociale}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{formatEuros(t.previsionnel_capex)}</td>
                  <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{formatEuros(t.previsionnel_opex)}</td>
                  <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-200 font-medium">{formatEuros(t.alloue_capex)}</td>
                  <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-200 font-medium">{formatEuros(t.alloue_opex)}</td>
                  <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-200 font-medium">{formatEuros(t.engage)}</td>
                  <EcartCell valeur={t.ecart_alloue_engage} />
                  <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{formatPourcentage(t.taux_engagement)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 font-semibold">
              <td className="px-3 py-2 text-gray-700 dark:text-gray-300 text-sm">Total</td>
              <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 text-sm">{formatEuros(total.previsionnel_capex)}</td>
              <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 text-sm">{formatEuros(total.previsionnel_opex)}</td>
              <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-200 text-sm">{formatEuros(total.alloue_capex)}</td>
              <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-200 text-sm">{formatEuros(total.alloue_opex)}</td>
              <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-200 text-sm">{formatEuros(total.engage)}</td>
              <EcartCell valeur={total.ecart_alloue_engage} />
              <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 text-sm">{formatPourcentage(total.taux_engagement)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
