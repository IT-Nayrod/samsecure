// BudgetProgressBar - Section Saisie Budget - SamSecure v0.5
// Code couleur du pourcentage realise (engage sur alloue) : classesRealisation
// dans budgetCalculs, partage avec la carte de taux d'engagement de BudgetKPIBar.
import { AlertTriangle } from 'lucide-react';
import { classesRealisation } from './budgetCalculs';

export default function BudgetProgressBar({ valeur, total, afficherPourcentage = true }) {
  if (!total || total === 0) return <span className="text-xs text-gray-400 dark:text-gray-500">-</span>;

  const pct = Math.round((valeur / total) * 100);
  const { barColor, textColor } = classesRealisation(pct);
  const displayPct = Math.min(pct, 100);

  return (
    <div className="flex flex-col gap-1 min-w-[80px]">
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
        <div
          className={`${barColor} h-1.5 rounded-full transition-all duration-300`}
          style={{ width: `${displayPct}%` }}
        />
      </div>
      {afficherPourcentage && (
        <div className={`flex items-center gap-0.5 text-xs font-medium ${textColor}`}>
          {pct > 100 && <AlertTriangle size={10} className="flex-shrink-0" />}
          <span>{pct} %</span>
        </div>
      )}
    </div>
  );
}
