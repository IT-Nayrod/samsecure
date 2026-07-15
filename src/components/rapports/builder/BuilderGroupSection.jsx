// BuilderGroupSection - Regroupement, granularite, agregats - SamSecure v0.5

const GRANULARITES = [
  { value: 'jour',      label: 'Jour' },
  { value: 'mois',      label: 'Mois' },
  { value: 'trimestre', label: 'Trimestre' },
  { value: 'annee',     label: 'Année' },
];

const FONCTIONS_AGG = [
  { value: 'somme',    label: 'Somme' },
  { value: 'moyenne',  label: 'Moyenne' },
  { value: 'min',      label: 'Min' },
  { value: 'max',      label: 'Max' },
  { value: 'nombre',   label: 'Nb lignes' },
];

export default function BuilderGroupSection({ champs, champsNumeriques, groupement, granularite, aggregations, onChange }) {
  const champSelectionne = champs.find(c => c.key === groupement);
  const estDate = champSelectionne?.type === 'date';

  function update(patch) { onChange({ groupement, granularite, aggregations, ...patch }); }

  function toggleAgg(champ, fn) {
    const key = `${champ}__${fn}`;
    const exists = aggregations.some(a => a.champ === champ && a.fonction === fn);
    if (exists) {
      update({ aggregations: aggregations.filter(a => !(a.champ === champ && a.fonction === fn)) });
    } else {
      update({ aggregations: [...aggregations, { champ, fonction: fn }] });
    }
  }

  function isAggActive(champ, fn) {
    return aggregations.some(a => a.champ === champ && a.fonction === fn);
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Regroupement</h3>

      {/* Champ de regroupement */}
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Regrouper par</label>
        <select
          value={groupement ?? ''}
          onChange={e => update({ groupement: e.target.value || null })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
        >
          <option value="">(Aucun regroupement)</option>
          {champs.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>

      {/* Granularite (si champ date) */}
      {groupement && estDate && (
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Granularité</label>
          <div className="flex gap-1 flex-wrap">
            {GRANULARITES.map(g => (
              <button
                key={g.value}
                type="button"
                onClick={() => update({ granularite: g.value })}
                className={`px-2 py-1 text-xs rounded transition-colors ${granularite === g.value ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Agregats sur champs numeriques */}
      {groupement && champsNumeriques.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Agregats</p>
          <div className="space-y-2">
            {champsNumeriques.map(c => (
              <div key={c.key} className="flex items-center gap-1 flex-wrap">
                <span className="text-xs text-gray-600 dark:text-gray-400 w-24 flex-shrink-0 truncate">{c.label}</span>
                {FONCTIONS_AGG.map(fn => (
                  <button
                    key={fn.value}
                    type="button"
                    onClick={() => toggleAgg(c.key, fn.value)}
                    className={`px-1.5 py-0.5 text-[11px] rounded transition-colors ${isAggActive(c.key, fn.value) ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {fn.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
