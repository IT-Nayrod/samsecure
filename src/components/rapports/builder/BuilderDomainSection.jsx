// BuilderDomainSection - Selection du domaine de donnees - SamSecure v0.5
import {
  KeyRound, Tag, FileText, ShoppingCart, Receipt, Wrench, PiggyBank, ShieldCheck,
} from 'lucide-react';

const ICONS = { KeyRound, Tag, FileText, ShoppingCart, Receipt, Wrench, PiggyBank, ShieldCheck };

export default function BuilderDomainSection({ domaines, value, onChange }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">Source de données</h3>
      <div className="space-y-1.5">
        {domaines.map(d => {
          const IconComp = ICONS[d.icone] ?? ShieldCheck;
          const actif = value === d.value;
          return (
            <label
              key={d.value}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${actif ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
            >
              <input type="radio" name="domaine" value={d.value} checked={actif} onChange={() => onChange(d.value)} className="sr-only" />
              <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${actif ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300 dark:border-gray-500'}`} />
              <IconComp className={`w-4 h-4 flex-shrink-0 ${actif ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
              <span className={`text-sm ${actif ? 'font-medium text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}`}>{d.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
