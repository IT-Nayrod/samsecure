// BuilderChartSection - Selecteur de type de graphique - SamSecure v0.5
// Necessite un regroupement actif pour etre disponible.
import { BarChart2, PieChart, TrendingUp, XCircle } from 'lucide-react';

const TYPES_GRAPHIQUE = [
  { value: 'bar',             label: 'Barres',             icon: BarChart2 },
  { value: 'bar_horizontal',  label: 'Barres horizontales', icon: BarChart2 },
  { value: 'line',            label: 'Ligne',              icon: TrendingUp },
  { value: 'pie',             label: 'Camembert',          icon: PieChart },
];

export default function BuilderChartSection({ graphique, onGraphiqueChange, groupementActif, champsNumeriques }) {
  if (!groupementActif) {
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Graphique</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">Nécessite un regroupement actif.</p>
      </div>
    );
  }

  const currentType = graphique?.type ?? null;
  const currentValueKey = graphique?.valueKey ?? '';

  function selectType(type) {
    if (currentType === type) { onGraphiqueChange(null); return; }
    const vk = champsNumeriques[0]?.key ?? '';
    onGraphiqueChange({ type, valueKey: vk });
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Graphique</h3>

      <div className="grid grid-cols-2 gap-1.5">
        {TYPES_GRAPHIQUE.map(t => {
          const IconComp = t.icon;
          const actif = currentType === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => selectType(t.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${actif ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
            >
              <IconComp className="w-3.5 h-3.5 flex-shrink-0" />
              {t.label}
            </button>
          );
        })}
      </div>

      {currentType && champsNumeriques.length > 0 && (
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Valeur à représenter</label>
          <select
            value={currentValueKey}
            onChange={e => onGraphiqueChange({ ...graphique, valueKey: e.target.value })}
            className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
          >
            {champsNumeriques.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
      )}

      {currentType && (
        <button type="button" onClick={() => onGraphiqueChange(null)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
          <XCircle className="w-3.5 h-3.5" />
          Retirer le graphique
        </button>
      )}
    </div>
  );
}
