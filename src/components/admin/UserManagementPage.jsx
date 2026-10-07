// UserManagementPage - page unique de gestion des utilisateurs, regroupant
// Utilisateurs / Profils / Exceptions / Journal sous forme d'onglets. Chaque
// onglet n'est visible que si l'utilisateur détient la permission réelle
// correspondante.
//
// Tout est profil (#276, 06/10/2026) : l'onglet Groupes personnalisés a
// disparu, les groupes existants sont devenus des profils ajoutés. L'onglet
// Profils (gerer_profils) porte désormais tout le cycle de vie : profils par
// défaut verrouillés, profils ajoutés (création, renommage, matrices,
// corbeille #64 et restauration). L'attribution reste dans la fiche
// utilisateur (section Profils, gerer_utilisateurs).
import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Shield, ClipboardList, ScrollText } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { ADMIN_PERMISSIONS } from '../../constants/permissions';
import UsersPage from '../users/UsersPage';
import ProfilsPage from './ProfilsPage';
import ExceptionsPage from './ExceptionsPage';
import JournalPage from './JournalPage';

const TABS = [
  { key: 'utilisateurs', label: 'Utilisateurs', icon: Users, permission: ADMIN_PERMISSIONS.UTILISATEURS, Component: UsersPage },
  { key: 'profils', label: 'Profils', icon: Shield, permission: ADMIN_PERMISSIONS.PROFILS, Component: ProfilsPage },
  { key: 'exceptions', label: 'Exceptions', icon: ClipboardList, permission: ADMIN_PERMISSIONS.EXCEPTIONS, Component: ExceptionsPage },
  { key: 'journal', label: 'Journal', icon: ScrollText, permission: ADMIN_PERMISSIONS.JOURNAL, Component: JournalPage },
];

export default function UserManagementPage() {
  const { hasPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const visibleTabs = useMemo(() => TABS.filter((t) => hasPermission(t.permission)), [hasPermission]);
  const tabFromUrl = searchParams.get('tab');
  const [active, setActive] = useState(
    visibleTabs.some((t) => t.key === tabFromUrl) ? tabFromUrl : visibleTabs[0]?.key
  );

  const activeTab = visibleTabs.find((t) => t.key === active) || visibleTabs[0];

  if (!activeTab) {
    // La route est déjà gardée par requireAnyPermission : cas normalement inatteignable.
    return null;
  }

  const ActiveComponent = activeTab.Component;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              activeTab.key === t.key
                ? 'border-blue-700 text-blue-700 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>
      <ActiveComponent />
    </div>
  );
}
