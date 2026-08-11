// SocieteSelector - sélecteur de sociétés unique et réutilisé partout où
// l'application choisit une ou plusieurs sociétés (diffusion d'un groupe,
// rattachement d'un utilisateur, portée d'une exception...). Menu déroulant +
// cases à cocher, arborescence indentée avec marqueurs `|_` sur les enfants,
// libellé de synthèse. `multiple=false` restreint la sélection à un seul
// élément (coche suivante remplace la précédente, ferme le menu).
import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { sortByHierarchy } from '../../utils/societeHierarchy';

export default function SocieteSelector({
  organisations,
  selectedIds,
  onChange,
  multiple = true,
  placeholder = 'Sélectionner des organisations…',
  disabledIds = [],
  disabledHint,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const tree = sortByHierarchy(organisations || []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  function toggle(id) {
    if (disabledIds.includes(id)) return;
    if (multiple) {
      onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
    } else {
      onChange(selectedIds.includes(id) ? [] : [id]);
      setOpen(false);
    }
  }

  const label = selectedIds.length === 0
    ? placeholder
    : multiple
      ? `${selectedIds.length} société(s) sélectionnée(s)`
      : organisations?.find((o) => o.id === selectedIds[0])?.raison_sociale || '1 société sélectionnée';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className="truncate text-left text-gray-700 dark:text-gray-200">{label}</span>
        <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1">
          {tree.map((o) => {
            const disabled = disabledIds.includes(o.id);
            return (
              <label
                key={o.id}
                title={disabled ? disabledHint : undefined}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm whitespace-nowrap ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                style={{ paddingLeft: 12 + o.depth * 18 }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(o.id)}
                  disabled={disabled}
                  onChange={() => toggle(o.id)}
                  className="rounded border-gray-300 flex-shrink-0"
                />
                <span className="text-gray-700 dark:text-gray-200">
                  {o.depth > 0 && <span className="text-gray-400">{'  '.repeat(o.depth - 1)}|_ </span>}
                  {o.raison_sociale}
                </span>
              </label>
            );
          })}
          {tree.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">Aucune organisation.</p>}
        </div>
      )}
    </div>
  );
}
