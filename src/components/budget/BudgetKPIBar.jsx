// BudgetKPIBar - Section Visualisation Budget - SamSecure v0.5
import { TrendingUp, TrendingDown } from 'lucide-react';
import Skeleton from '../ui/Skeleton';
import { calcBudgetKpis } from './budgetCalculs';

const fmtEur = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

function KpiCard({ label, valeur }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-tight">{label}</span>
      <span className="text-lg font-bold text-gray-900 dark:text-white">{fmtEur(valeur)}</span>
    </div>
  );
}

function EcartCard({ label, valeur }) {
  const isPositif = valeur >= 0;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-tight">{label}</span>
      <div className={`flex items-center gap-1.5 text-lg font-bold ${isPositif ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
        {isPositif ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
        <span>{isPositif ? '+' : ''}{fmtEur(valeur)}</span>
      </div>
    </div>
  );
}

export default function BudgetKPIBar({ lignes, isLoading = false }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height="h-20" />)}
      </div>
    );
  }

  const { capex_engage, capex_alloue, ecart_capex, opex_engage, opex_alloue, ecart_opex } = calcBudgetKpis(lignes);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <KpiCard label="CAPEX engage" valeur={capex_engage} />
      <KpiCard label="CAPEX alloue" valeur={capex_alloue} />
      <EcartCard label="Ecart CAPEX" valeur={ecart_capex} />
      <KpiCard label="OPEX projete / engage" valeur={opex_engage} />
      <KpiCard label="OPEX alloue" valeur={opex_alloue} />
      <EcartCard label="Ecart OPEX" valeur={ecart_opex} />
    </div>
  );
}
