// Topbar - Section 1.3 Specs UX v0.5
import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Menu, LogOut, User, ChevronRight, ChevronDown } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import useNotifications from '../../hooks/useNotifications';
import NotifDrawer from '../notifications/NotifDrawer';
import GlobalSearch from '../search/GlobalSearch';

const BREADCRUMBS = {
  '/dashboard': [{ label: 'Tableau de bord' }],
  '/admin/users': [{ label: 'Administration' }, { label: 'Utilisateurs' }],
  '/admin/settings': [{ label: 'Administration' }, { label: 'Paramètres' }],
  '/admin/connectors': [{ label: 'Administration' }, { label: 'Connecteurs' }],
  '/settings/me': [{ label: 'Paramètres utilisateur' }],
  '/unauthorized': [{ label: 'Accès refusé' }],
};

function getBreadcrumb(pathname) {
  if (BREADCRUMBS[pathname]) return BREADCRUMBS[pathname];
  const prefixes = ['/referentiels', '/contrats', '/conformite', '/rapports'];
  for (const p of prefixes) {
    if (pathname.startsWith(p)) {
      const section = { '/referentiels': 'Référentiels', '/contrats': 'Contrats', '/conformite': 'Conformité', '/rapports': 'Rapports' }[p];
      return [{ label: section }];
    }
  }
  return [{ label: 'SamSecure' }];
}

function initials(user) {
  if (!user) return '?';
  return `${user.prenom?.[0] ?? ''}${user.nom?.[0] ?? ''}`.toUpperCase();
}

export default function Topbar({ onMenuClick }) {
  const { user, profil, logout, switchProfil } = useAuth();
  const { unreadCount } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef(null);

  const breadcrumb = getBreadcrumb(location.pathname);
  const hasMultipleProfils = (user?.habilitations?.length ?? 0) > 1;

  useEffect(() => {
    function handleClick(e) {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setAvatarOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const PROFIL_LABELS = { manager_dsi: 'Manager DSI', financier: 'Financier', it_ops: 'IT Ops' };

  return (
    <>
      <header className="h-14 flex items-center gap-4 px-4 md:px-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        {/* Hamburger mobile */}
        <button onClick={onMenuClick} aria-label="Ouvrir le menu" className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
          <Menu size={20} />
        </button>

        {/* Breadcrumb */}
        <nav aria-label="Fil d'Ariane" className="flex items-center gap-1 text-sm min-w-0 flex-shrink-0 hidden sm:flex">
          {breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={14} className="text-gray-400" />}
              {i < breadcrumb.length - 1
                ? <Link to="#" className="text-gray-500 hover:text-gray-700 dark:text-gray-400">{crumb.label}</Link>
                : <span className="font-medium text-gray-900 dark:text-white">{crumb.label}</span>
              }
            </span>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Search */}
        <GlobalSearch />

        {/* Bell */}
        <button
          onClick={() => setNotifOpen(true)}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ''}`}
          className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Avatar dropdown */}
        <div className="relative" ref={avatarRef}>
          <button
            onClick={() => setAvatarOpen(v => !v)}
            aria-label="Menu utilisateur"
            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold">
              {initials(user)}
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 hidden sm:block">{user?.prenom}</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {avatarOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-40">
              <button
                onClick={() => { navigate('/settings/me'); setAvatarOpen(false); }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <User size={15} /> Mon profil
              </button>

              {hasMultipleProfils && (
                <>
                  <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                  <p className="px-4 py-1 text-[10px] text-gray-400 uppercase tracking-wider">Changer de profil</p>
                  {user.habilitations.map(hab => (
                    <button
                      key={`${hab.profil}-${hab.societe_id}`}
                      onClick={() => { switchProfil(hab.profil); setAvatarOpen(false); }}
                      className={`flex items-center gap-2.5 w-full px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${hab.profil === profil ? 'text-blue-700 font-medium' : 'text-gray-700 dark:text-gray-200'}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                      {PROFIL_LABELS[hab.profil]}
                    </button>
                  ))}
                </>
              )}

              <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
              <button
                onClick={() => { logout(); navigate('/login'); }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <LogOut size={15} /> Se déconnecter
              </button>
            </div>
          )}
        </div>
      </header>

      <NotifDrawer isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  );
}
