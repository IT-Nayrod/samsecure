// MatricePermissions - matrice de cases à cocher par permission, groupées par
// module (#249). Composant contrôlé, sans sauvegarde : l'écran hôte décide du
// mode d'enregistrement (remplacement complet pour les profils par défaut,
// onglet Profils de l'administration et de la fiche société).
import { MODULES } from '../../constants/permissions';

export default function MatricePermissions({ catalogue, selectedIds, onToggle, disabled = false }) {
  const groupes = MODULES.map((m) => [m.label, catalogue.filter((p) => p.module === m.code)])
    .filter(([, perms]) => perms.length > 0);
  const connus = new Set(MODULES.map((m) => m.code));
  const autres = catalogue.filter((p) => !connus.has(p.module));
  if (autres.length) groupes.push(['Autre', autres]);

  return (
    <div className="flex flex-col gap-4">
      {groupes.map(([moduleName, perms]) => (
        <div key={moduleName}>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{moduleName}</p>
          <div className="flex flex-col gap-1">
            {perms.map((p) => (
              <label
                key={p.id}
                className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${disabled ? 'opacity-70' : 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={selectedIds.has(p.id)}
                  onChange={(e) => onToggle(p.id, e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-gray-700 dark:text-gray-200">{p.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
