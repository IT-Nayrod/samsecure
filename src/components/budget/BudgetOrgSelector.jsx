// BudgetOrgSelector - Section Budget - SamSecure v0.5
// Composant controle : le parent (BudgetPage) porte l'etat societeId + consolider
// et fournit la liste des organisations servie par /societes (id_societe_parent).
// Expose deux callbacks : onSocieteChange(id) et onConsoliderChange(bool).
import { useMemo } from 'react';
import { sortByHierarchy } from '../../utils/societeHierarchy';

const SELECT_CLS = 'text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function BudgetOrgSelector({ societes = [], societeId, consolider, onSocieteChange, onConsoliderChange }) {
  const options = useMemo(() => sortByHierarchy(societes), [societes]);
  const hasChildren = societeId ? societes.some(s => s.id_societe_parent === societeId) : false;

  function handleSocieteChange(id) {
    onSocieteChange(id);
    onConsoliderChange(true);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={societeId}
        onChange={e => handleSocieteChange(e.target.value)}
        className={SELECT_CLS}
        aria-label="Organisation"
      >
        <option value="">Toutes les organisations</option>
        {/* Indentation par espaces insecables, sans glyphe : le texte de
            l'option est aussi la valeur affichee par le selecteur ferme. */}
        {options.map(opt => (
          <option key={opt.id} value={opt.id}>
            {'\u00A0\u00A0\u00A0'.repeat(opt.depth)}{opt.raison_sociale}
          </option>
        ))}
      </select>

      {hasChildren && (
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={consolider}
            onChange={e => onConsoliderChange(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
          />
          Consolider les filiales
        </label>
      )}
    </div>
  );
}
