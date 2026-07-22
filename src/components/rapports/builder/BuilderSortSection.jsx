// BuilderSortSection - Criteres de tri (max 3) - SamSecure v0.5
import { Plus, X } from 'lucide-react';

export default function BuilderSortSection({ champs, tri, onChange }) {
  function ajouterCritere() {
    if (tri.length >= 3 || !champs.length) return;
    onChange([...tri, { champ: champs[0].key, direction: 'asc' }]);
  }

  function modifierCritere(idx, patch) {
    onChange(tri.map((c, i) => i === idx ? { ...c, ...patch } : c));
  }

  function supprimerCritere(idx) {
    onChange(tri.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Tri</h3>

      <div className="space-y-2">
        {tri.map((critere, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-4 flex-shrink-0">{idx + 1}.</span>
            <select
              value={critere.champ}
              onChange={e => modifierCritere(idx, { champ: e.target.value })}
              className="flex-1 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 min-w-0"
            >
              {champs.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <select
              value={critere.direction}
              onChange={e => modifierCritere(idx, { direction: e.target.value })}
              className="w-24 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
            >
              <option value="asc">Croissant</option>
              <option value="desc">Décroissant</option>
            </select>
            <button type="button" onClick={() => supprimerCritere(idx)} className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {tri.length < 3 && (
        <button
          type="button"
          onClick={ajouterCritere}
          disabled={!champs.length}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 rounded-lg hover:border-indigo-400 hover:text-indigo-600 transition-colors disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" />
          Ajouter un tri
        </button>
      )}
    </div>
  );
}
