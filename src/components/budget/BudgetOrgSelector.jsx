// BudgetOrgSelector - Section Budget - SamSecure v0.5
// Composant controle : le parent (BudgetPage) porte l'etat societeId + consolider.
// Expose deux callbacks : onSocieteChange(id) et onConsoliderChange(bool).
import { mockSocietes } from '../../data/mockReferentiels';

const SELECT_CLS = 'text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

function buildOrgOptions(societes) {
  const options = [];
  function addWithChildren(soc, depth) {
    options.push({ id: soc.id, label: soc.raison_sociale, depth });
    societes.filter(s => s.societe_parent_id === soc.id).forEach(c => addWithChildren(c, depth + 1));
  }
  societes.filter(s => !s.societe_parent_id).forEach(s => addWithChildren(s, 0));
  return options;
}

const ORG_OPTIONS = buildOrgOptions(mockSocietes);

export default function BudgetOrgSelector({ societeId, consolider, onSocieteChange, onConsoliderChange }) {
  const hasChildren = societeId
    ? mockSocietes.some(s => s.societe_parent_id === societeId)
    : false;

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
        {ORG_OPTIONS.map(opt => (
          <option key={opt.id} value={opt.id}>
            {'  '.repeat(opt.depth)}{opt.depth > 0 ? '↷ ' : ''}{opt.label}
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
