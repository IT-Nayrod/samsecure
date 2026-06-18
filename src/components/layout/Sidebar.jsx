// Sidebar - Section 1.2 Specs UX v0.5
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Store, Users, Package,
  FileText, ShoppingCart, Receipt, Shield, Tag, Database,
  BarChart2, UserCog, Settings, Plug, Settings2,
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';

const MENU = [
  {
    section: 'TABLEAU DE BORD',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', profiles: ['manager_dsi', 'financier', 'it_ops'] },
    ],
  },
  {
    section: 'RÉFÉRENTIELS',
    items: [
      { label: 'Editeurs', icon: Building2, path: '/referentiels/editeurs', profiles: ['manager_dsi', 'it_ops'] },
      { label: 'Revendeurs', icon: Store, path: '/referentiels/revendeurs', profiles: ['manager_dsi', 'it_ops'] },
      { label: 'Contacts', icon: Users, path: '/referentiels/contacts', profiles: ['manager_dsi', 'it_ops'] },
      { label: 'Logiciels', icon: Package, path: '/referentiels/logiciels', profiles: ['manager_dsi', 'it_ops'] },
    ],
  },
  {
    section: 'CONTRATS',
    items: [
      { label: 'Contrats', icon: FileText, path: '/contrats/liste', profiles: ['manager_dsi', 'it_ops'] },
      { label: 'Commandes', icon: ShoppingCart, path: '/contrats/commandes', profiles: ['manager_dsi', 'it_ops'] },
      { label: 'Factures & Preuves', icon: Receipt, path: '/contrats/factures', profiles: ['manager_dsi', 'it_ops'] },
    ],
  },
  {
    section: 'CONFORMITÉ',
    items: [
      { label: 'Licences', icon: Shield, path: '/conformite/licences', profiles: ['manager_dsi', 'financier', 'it_ops'] },
      { label: 'Affectations', icon: Tag, path: '/conformite/affectations', profiles: ['manager_dsi', 'financier', 'it_ops'] },
      { label: 'Inventaire', icon: Database, path: '/conformite/inventaire', profiles: ['manager_dsi', 'it_ops'] },
    ],
  },
  {
    section: 'RAPPORTS',
    items: [
      { label: 'Rapports', icon: BarChart2, path: '/rapports', profiles: ['manager_dsi', 'financier'] },
    ],
  },
  {
    section: 'ADMINISTRATION',
    items: [
      { label: 'Utilisateurs', icon: UserCog, path: '/admin/users', profiles: ['manager_dsi'] },
      { label: 'Paramètres', icon: Settings, path: '/admin/settings', profiles: ['manager_dsi'] },
      { label: 'Connecteurs', icon: Plug, path: '/admin/connectors', profiles: ['manager_dsi'] },
    ],
  },
];

function initials(user) {
  if (!user) return '?';
  return `${user.prenom?.[0] ?? ''}${user.nom?.[0] ?? ''}`.toUpperCase();
}

export default function Sidebar({ onClose }) {
  const { user, profil, navigate: _nav } = useAuth();
  const navigate = useNavigate();

  const visibleMenu = MENU.map(section => ({
    ...section,
    items: section.items.filter(item => item.profiles.includes(profil)),
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
