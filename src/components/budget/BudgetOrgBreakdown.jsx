// BudgetOrgBreakdown - Repartition du budget par organisation - SamSecure v0.5
// Affiche uniquement quand le perimetre couvre plus d'une societe avec du budget.
// Clic sur une ligne = drill-down via onSelectSociete(id).
import { useMemo } from 'react';
import { mockSocietes } from '../../data/mockReferentiels';
import { mockLicences } from '../../data/mockDeploiement';
import { mockCommandes } from '../../data/mockContrats';
import { getSocieteDeLicence } from '../../utils/orgUtils';

const fmtEur = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

const SOURCES = { licences: mockLicences, commandes: mockCommandes, societes: mockSocietes };

function computeKpis(lignes, idSociete) {
  const filtered = lignes.filter(b => {
    const s = getSocieteDeLicence(b.id_licence, SOURCES);
    return s?.id === idSociete;
  });
  const alloue = filtered.filter(b => b.type === 'alloue');
  const prev = filtered.filter(b => b.type === 'previsionnel');
  return {
    capex_alloue: prev.reduce((s, b) => s + b.montant_CAPEX, 0),
    capex_engage: alloue.reduce((s, b) => s + b.montant_CAPEX, 0),
    opex_alloue: prev.reduce((s, b) => s + b.montant_OPEX, 0),
    opex_engage: alloue.reduce((s, b) => s + b.montant_OPEX, 0),
  };
}

// Trie les societes hierarchiquement : parentes d'abord, filiales en dessous
function sortByHierarchy(rows) {
  const rowMap = new Map(rows.map(r => [r.societe.id, r]));
  const sorted = [];
  function addWithChildren(id) {
    const row = rowMap.get(id);
    if (row) sorted.push(row);
    rows.filter(r => r.societe.societe_parent_id === id && rowMap.has(r.societe.id)).forEach(r => addWithChildren(r.societe.id));
  }
  rows.filter(r => !r.societe.societe_parent_id || !rowMap.has(r.societe.societe_parent_id)).forEach(r => addWithChildren(r.societe.id));
  return sorted;
}

function EcartCell({ valeur }) {
  const pos = valeur >= 0;
  return (
    <td className={`px-3 py-2 text-right text-sm font-medium ${pos ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {pos ? '+' : ''}{fmtEur(valeur)}
    </td>
  );
}

export default function BudgetOrgBreakdown({ lignes, period, societeIds, onSelectSociete }) {
  const lignesPeriode = useMemo(() => {
    if (!period?.debut || !period?.fin) return lignes;
    return lignes.filter(b => new Date(b.date_debut) <= period.fin && new Date(b.date_fin) >= period.debut);
  }, [lignes, period]);

  const societesPerimetre = useMemo(() =>
    societeIds ? mockSocietes.filter(s => societeIds.includes(s.id)) : mockSocietes,
    [societeIds]
  );

  const rows = useMemo(() => {
    const all = societesPerimetre.map(s => ({ societe: s, ...computeKpis(lignesPeriode, s.id) }));
    return sortByHierarchy(all.filter(r => r.capex_alloue > 0 || r.capex_engage > 0 || r.opex_alloue > 0 || r.opex_engage > 0));
  }, [lignesPeriode, societesPerimetre]);

  const total = useMemo(() => rows.reduce(
    (acc, r) => ({
      capex_alloue: acc.capex_alloue + r.capex_alloue,
      capex_engage: acc.capex_engage + r.capex_engage,
      opex_alloue: acc.opex_alloue + r.opex_alloue,
      opex_engage: acc.opex_engage + r.opex_engage,
    }),
    { capex_alloue: 0, capex_engage: 0, opex_alloue: 0, opex_engage: 0 }
  ), [rows]);

  if (rows.length <= 1) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Repartition par organisation</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Cliquez sur une ligne pour filtrer sur cette organisation</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Organisation</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">CAPEX alloue</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">CAPEX engage</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ecart CAPEX</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">OPEX alloue</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">OPEX engage</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ecart OPEX</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const isFiliale = !!r.societe.societe_parent_id;
              return (
                <tr
                  key={r.societe.id}
                  onClick={() => onSelectSociete?.(r.societe.id)}
                  className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                    {isFiliale && <span className="text-gray-400 mr-1">&#8627;</span>}
                    <span className={isFiliale ? 'pl-2' : ''}>{r.societe.raison_sociale}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{fmtEur(r.capex_alloue)}</td>
                  <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-200 font-medium">{fmtEur(r.capex_engage)}</td>
                  <EcartCell valeur={r.capex_alloue - r.capex_engage} />
                  <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{fmtEur(r.opex_alloue)}</td>
                  <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-200 font-medium">{fmtEur(r.opex_engage)}</td>
                  <EcartCell valeur={r.opex_alloue - r.opex_engage} />
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 font-semibold">
              <td className="px-3 py-2 text-gray-700 dark:text-gray-300 text-sm">Total</td>
              <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 text-sm">{fmtEur(total.capex_alloue)}</td>
              <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-200 text-sm">{fmtEur(total.capex_engage)}</td>
              <EcartCell valeur={total.capex_alloue - total.capex_engage} />
              <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 text-sm">{fmtEur(total.opex_alloue)}</td>
              <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-200 text-sm">{fmtEur(total.opex_engage)}</td>
              <EcartCell valeur={total.opex_alloue - total.opex_engage} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
