// ManqueBadge - indicateur de piece justificative manquante (risque audit)
import { AlertTriangle } from 'lucide-react';

export default function ManqueBadge({ label }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
      <AlertTriangle size={11} /> {label}
    </span>
  );
}
