// LogoEditeur - logo de l'editeur (public/logos/{slug}.svg) avec repli avatar a initiales
import { colorForName, initialsForName } from '../../utils/avatar';

export default function LogoEditeur({ editeur, size = 28 }) {
  if (!editeur) return null;
  const dimension = { width: size, height: size };

  if (editeur.logo_slug) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-700 ring-1 ring-gray-200/70 dark:ring-gray-600/50 flex-shrink-0 overflow-hidden"
        style={{ ...dimension, padding: Math.max(2, size * 0.12) }}
      >
        <img
          src={`/logos/${editeur.logo_slug}.svg`}
          alt={editeur.raison_sociale}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center justify-center rounded-lg flex-shrink-0 font-semibold text-white"
      style={{ ...dimension, backgroundColor: colorForName(editeur.raison_sociale), fontSize: size * 0.4 }}
      title={editeur.raison_sociale}
    >
      {initialsForName(editeur.raison_sociale)}
    </span>
  );
}
