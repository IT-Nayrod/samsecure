// LogoEditeur - logo de l'editeur, avec repli sur un avatar a initiales.
//
// La source du logo vient de la base : url_logo_custom, deposee par le client,
// prime sur url_logo_defaut, livree par SamSecure (002_tenant_schema.sql:254).
// Les deux sont des chemins complets, du type /logos/microsoft.svg.
//
// logo_slug reste accepte en dernier recours : le module 3 passe encore par
// editeurPourLogo() (src/services/licencesService.js), qui convertit l'URL en
// slug pour l'ancienne entree de ce composant. Cette conversion n'a plus lieu
// d'etre et pourra disparaitre avec ces trois lignes, une fois le helper
// simplifie.
import { colorForName, initialsForName } from '../../utils/avatar';

export default function LogoEditeur({ editeur, size = 28 }) {
  if (!editeur) return null;
  const dimension = { width: size, height: size };
  const url = editeur.url_logo_custom
    || editeur.url_logo_defaut
    || (editeur.logo_slug ? `/logos/${editeur.logo_slug}.svg` : null);
  const nom = editeur.raison_sociale ?? '';

  if (url) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-700 ring-1 ring-gray-200/70 dark:ring-gray-600/50 flex-shrink-0 overflow-hidden"
        style={{ ...dimension, padding: Math.max(2, size * 0.12) }}
      >
        <img
          src={url}
          alt={nom}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center justify-center rounded-lg flex-shrink-0 font-semibold text-white"
      style={{ ...dimension, backgroundColor: colorForName(nom), fontSize: size * 0.4 }}
      title={nom}
    >
      {initialsForName(nom)}
    </span>
  );
}
