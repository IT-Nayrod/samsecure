// BuilderOptionsSection - Options diverses du rapport personnalise - SamSecure v0.5

const MAX_LIGNES_OPTIONS = [
  { value: 'toutes', label: 'Toutes les lignes' },
  { value: '25',     label: '25 lignes' },
  { value: '50',     label: '50 lignes' },
  { value: '100',    label: '100 lignes' },
  { value: '200',    label: '200 lignes' },
  { value: '500',    label: '500 lignes' },
];

export default function BuilderOptionsSection({ options, onChange }) {
  function update(patch) { onChange({ ...options, ...patch }); }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Options</h3>

      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Titre du rapport</label>
        <input
          type="text"
          value={options.titre ?? ''}
          onChange={e => update({ titre: e.target.value })}
          placeholder="Mon rapport personnalise"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Description</label>
        <textarea
          value={options.description ?? ''}
          onChange={e => update({ description: e.target.value })}
          placeholder="Description optionnelle..."
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 resize-none"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Nb max de lignes</label>
        <select
          value={options.lignesMax ?? 'toutes'}
          onChange={e => update({ lignesMax: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
        >
          {MAX_LIGNES_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={options.afficherNumerosLignes ?? false}
            onChange={e => update({ afficherNumerosLignes: e.target.checked })}
            className="rounded border-gray-300 text-indigo-600 w-4 h-4"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Afficher les numeros de lignes</span>
        </label>
      </div>
    </div>
  );
}
