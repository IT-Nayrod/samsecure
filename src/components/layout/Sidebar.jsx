// Sidebar - Section 1.2 Specs UX v0.5
// Règle d'affichage (itération courante) : aucun bridage par rôle, à
// l'exception de la section ADMINISTRATION, dont chaque entrée est mappée
// sur sa permission réelle du catalogue. Une entrée sans `permission` est
// visible par tout utilisateur connecté.
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Building, Building2, Store, Users, Package,
  FileText, ShoppingCart, Receipt, Shield, Tag, Database,
  ShieldCheck, TrendingUp, SlidersHorizontal, UserCog, Settings, Plug, Settings2, PiggyBank,
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { ADMIN_PERMISSIONS } from '../../constants/permissions';

const MENU = [
  {
    section: 'TABLEAU DE BORD',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    ],
  },
  {
    section: 'RÉFÉRENTIELS',
    items: [
      { label: 'Editeurs', icon: Building2, path: '/referentiels/editeurs' },
      { label: 'Revendeurs', icon: Store, path: '/referentiels/revendeurs' },
      { label: 'Contacts', icon: Users, path: '/referentiels/contacts' },
      { label: 'Logiciels', icon: Package, path: '/referentiels/logiciels' },
    ],
  },
  {
    section: 'DROITS D\'USAGE',
    items: [
      { label: 'Licences', icon: Shield, path: '/conformite/licences' },
      { label: 'Contrat', icon: FileText, path: '/contrats/liste' },
      { label: 'Commandes', icon: ShoppingCart, path: '/contrats/commandes' },
      { label: 'Factures & Preuves', icon: Receipt, path: '/contrats/factures' },
    ],
  },
  {
    section: 'USAGE',
    items: [
      { label: 'Affectations', icon: Tag, path: '/conformite/affectations' },
      { label: 'Inventaire', icon: Database, path: '/conformite/inventaire' },
    ],
  },
  {
    section: 'BUDGET',
    items: [
      { label: 'Budget', icon: PiggyBank, path: '/budget' },
    ],
  },
  {
    section: 'RAPPORTS',
    items: [
      { label: 'Conformité', icon: ShieldCheck, path: '/rapports/conformite' },
      { label: 'Optimisation', icon: TrendingUp, path: '/rapports/optimisation' },
      { label: 'Personnalisé', icon: SlidersHorizontal, path: '/rapports/personnalise' },
    ],
  },
  {
    section: 'ADMINISTRATION',
    items: [
      { label: 'Organisation', icon: Building, path: '/referentiels/organisation', permission: ADMIN_PERMISSIONS.SOCIETES },
      {
        label: 'Utilisateurs', icon: UserCog, path: '/admin/utilisateurs',
        permissions: [ADMIN_PERMISSIONS.UTILISATEURS, ADMIN_PERMISSIONS.GROUPES, ADMIN_PERMISSIONS.EXCEPTIONS, ADMIN_PERMISSIONS.JOURNAL],
      },
      { label: 'Paramètres', icon: Settings, path: '/admin/settings', permission: ADMIN_PERMISSIONS.UTILISATEURS },
      { label: 'Connecteurs', icon: Plug, path: '/admin/connectors', permission: ADMIN_PERMISSIONS.CONNECTEURS },
    ],
  },
];

function initials(user) {
  if (!user) return '?';
  return `${user.prenom?.[0] ?? ''}${user.nom?.[0] ?? ''}`.toUpperCase();
}

export default function Sidebar({ onClose }) {
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const navigate = useNavigate();

  function isVisible(item) {
    if (item.permissions) return hasAnyPermission(item.permissions);
    return !item.permission || hasPermission(item.permission);
  }

  const visibleMenu = MENU.map(section => ({
    ...section,
    items: section.items.filter(isVisible),
  })).filter(section => section.items.length > 0);

  return (
    <aside className="flex flex-col h-full bg-[#0D1117] overflow-hidden">
      {/* Logo */}
      <div className="px-5 py-5 flex-shrink-0">
        <span className="text-lg font-bold text-blue-400">Sam</span>
        <span className="text-lg font-bold text-white">Secure</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {visibleMenu.map(({ section, items }) => (
          <div key={section} className="mb-4">
            <p className="px-2 mb-1.5 text-[10px] font-semibold tracking-widest text-gray-500 uppercase select-none">
              {section}
            </p>
            {items.map(({ label, icon: Icon, path }) => (
              <NavLink
                key={path}
                to={path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-[#1F4E79] text-white font-semibold border-l-[3px] border-blue-400 pl-[9px]'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100 border-l-[3px] border-transparent pl-[9px]'
                  }`
                }
              >
                <Icon size={15} className="flex-shrink-0" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="flex-shrink-0 border-t border-gray-800 px-3 py-3">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials(user)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.prenom} {user?.nom}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={() => { navigate('/settings/me'); onClose?.(); }}
            aria-label="Paramètres utilisateur"
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors flex-shrink-0"
          >
            <Settings2 size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
