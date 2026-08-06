// DashboardPage - page principale avec sélecteur de dashboards
// Le dashboard affiché dépend des permissions dashboard réelles de
// l'utilisateur (héritées de ses groupes, exceptions comprises) : un membre
// de 1, 2 ou 3 groupes voit 1, 2 ou 3 dashboards. Le premier accessible est
// affiché par défaut ; le sélecteur ne liste que les dashboards accessibles.
import { useState, useMemo } from 'react';
import '../../styles/dashboard.css';
import RoleSelector from './RoleSelector';
import ManagerDSIDashboard from './ManagerDSIDashboard';
import FinancierDashboard from './FinancierDashboard';
import ITOpsDashboard from './ITOpsDashboard';
import useAuth from '../../hooks/useAuth';
import { DASHBOARDS } from '../../constants/permissions';

const COMPONENTS = {
  dsi: ManagerDSIDashboard,
  financier: FinancierDashboard,
  itops: ITOpsDashboard,
};

export default function DashboardPage() {
  const { hasPermission } = useAuth();
  const accessibles = useMemo(
    () => DASHBOARDS.filter((d) => hasPermission(d.permission)),
    [hasPermission]
  );
  const [role, setRole] = useState(accessibles[0]?.id ?? null);

  if (!accessibles.length) {
    return (
      <div className="text-center py-16 text-sm text-gray-500">
        Aucun dashboard n'est accessible avec vos droits actuels.
      </div>
    );
  }

  const activeId = accessibles.some((d) => d.id === role) ? role : accessibles[0].id;
  const ActiveDashboard = COMPONENTS[activeId];

  return (
    <div>
      {accessibles.length > 1 && (
        <div style={{ marginBottom: 24 }}>
          <RoleSelector activeRole={activeId} onChange={setRole} options={accessibles} />
        </div>
      )}
      <ActiveDashboard />
    </div>
  );
}
