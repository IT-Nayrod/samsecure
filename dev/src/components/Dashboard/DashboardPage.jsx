// DashboardPage — page principale avec sélecteur de rôle
// Gère le state du rôle actif (dsi | financier | itops)
import { useState } from 'react';
import '../../styles/dashboard.css';
import RoleSelector from './RoleSelector';
import ManagerDSIDashboard from './ManagerDSIDashboard';
import FinancierDashboard from './FinancierDashboard';
import ITOpsDashboard from './ITOpsDashboard';

const DASHBOARDS = {
  dsi:       ManagerDSIDashboard,
  financier: FinancierDashboard,
  itops:     ITOpsDashboard,
};

export default function DashboardPage() {
  const [role, setRole] = useState('dsi');
  const ActiveDashboard = DASHBOARDS[role];

  return (
    <div>
      {/* Sélecteur de rôle */}
      <div style={{ marginBottom: 24 }}>
        <RoleSelector activeRole={role} onChange={setRole} />
      </div>

      {/* Dashboard actif — pas de rechargement de page */}
      <ActiveDashboard />
    </div>
  );
}
