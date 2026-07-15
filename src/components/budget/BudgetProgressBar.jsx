// BudgetProgressBar - Section Saisie Budget - SamSecure v0.5
import { AlertTriangle } from 'lucide-react';

export default function BudgetProgressBar({ valeur, total, afficherPourcentage = true }) {
  if (!total || total === 0) return <span className="text-xs text-gray-400 dark:text-gray-500">-</span>;

  const pct = Math.round((valeur / total) * 100);

  let barColor, textColor;
  if (pct > 100) {
    barColor = 'bg-red-700';
    textColor = 'text-red-700 dark:text-red-400';
  } else if (pct >= 91) {
    barColor = 'bg-red-500';
    textColor = 'text-red-600 dark:text-red-400';
  } else if (pct >= 76) {
    barColor = 'bg-orange-400';
    textColor = 'text-orange-600 dark:text-orange-400';
  } else {
    barColor = 'bg-green-500';
    textColor = 'text-green-600 dark:text-green-400';
  }

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
