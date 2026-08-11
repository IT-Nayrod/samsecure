// BuilderColumnsSection - Selection et ordre des colonnes - SamSecure v0.5
import { ArrowUp, ArrowDown, X } from 'lucide-react';

export default function BuilderColumnsSection({ champsDisponibles, colonnes, onChange }) {
  const selectedKeys = new Set(colonnes);

  function toggleColonne(key) {
    if (selectedKeys.has(key)) {
      onChange(colonnes.filter(k => k !== key));
    } else {
      onChange([...colonnes, key]);
    }
  }

  function deplacer(idx, direction) {
    const next = [...colonnes];
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    onChange(next);
  }

  function retirer(key) {
    onChange(colonnes.filter(k => k !== key));
  }

  function labelChamp(key) {
    return champsDisponibles.find(c => c.key === key)?.label ?? key;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Colonnes</h3>

      {/* Champs disponibles */}
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Champs disponibles</p>
        <div className="grid grid-cols-1 gap-1">
          {champsDisponibles.map(c => (
            <label
              key={c.key}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer text-xs transition-colors ${selectedKeys.has(c.key) ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
            >
              <input type="checkbox" checked={selectedKeys.has(c.key)} onChange={() => toggleColonne(c.key)} className="rounded border-gray-300 text-indigo-600 w-3.5 h-3.5" />
              <span>{c.label}</span>
              <span className="ml-auto text-gray-400 text-[10px]">{c.type}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Colonnes selectionnees avec ordre */}
      {colonnes.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Ordre des colonnes</p>
          <div className="space-y-1">
            {colonnes.map((key, idx) => (
              <div key={key} className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50 rounded-md border border-gray-200 dark:border-gray-600">
                <span className="flex-1 text-xs text-gray-700 dark:text-gray-300 truncate">{labelChamp(key)}</span>
                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={() => deplacer(idx, -1)} disabled={idx === 0} className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button type="button" onClick={() => deplacer(idx, 1)} disabled={idx === colonnes.length - 1} className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button type="button" onClick={() => retirer(key)} className="p-0.5 text-gray-400 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
