import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  RefreshCw,
  Package,
  BarChart2,
  Users,
  Settings,
  Search,
} from 'lucide-react';

const menuItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/renouvellements', icon: RefreshCw, label: 'Renouvellements', badge: 2 },
  { path: '/parc-licences', icon: Package, label: 'Parc de licences' },
  { path: '/analyses-usage', icon: BarChart2, label: "Analyses d'usage" },
  { path: '/equipe', icon: Users, label: 'Equipe et attributions' },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside style={{
      width: '180px',
      minWidth: '180px',
      height: '100vh',
      backgroundColor: '#0D1117',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px' }}>
        <span style={{ fontSize: '18px', fontWeight: '700', color: '#7C6FCD' }}>Sam</span>
        <span style={{ fontSize: '18px', fontWeight: '700', color: '#FFFFFF' }}>Secure</span>
      </div>

      {/* Search */}
      <div style={{ padding: '0 12px 8px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#1E2028',
          borderRadius: '8px',
          padding: '8px 10px',
        }}>
          <Search size={14} color="#8B9099" />
          <input
            type="text"
            placeholder="Recherche"
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              color: '#8B9099',
              fontSize: '12px',
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* Menu label */}
      <div style={{
        padding: '20px 16px 8px',
        fontSize: '10px',
        fontWeight: '600',
        color: '#8B9099',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>
        Menu
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '0 8px' }}>
        {menuItems.map(({ path, icon: Icon, label, badge }) => {
          const isActive = location.pathname === path;
          return (
            <NavLink
              key={path}
              to={path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 10px',
                borderRadius: '8px',
                marginBottom: '2px',
                color: isActive ? '#7C6FCD' : '#8B9099',
                backgroundColor: isActive ? '#1E2028' : 'transparent',
                borderLeft: isActive ? '3px solid #7C6FCD' : '3px solid transparent',
                fontSize: '12px',
                fontWeight: isActive ? '600' : '400',
                position: 'relative',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = '#1E2028';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Icon size={15} />
              <span style={{ flex: 1, lineHeight: '1.3' }}>{label}</span>
              {badge && (
                <span style={{
                  backgroundColor: '#FF4757',
                  color: 'white',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: '700',
                  flexShrink: 0,
                }}>
                  {badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Parametres button */}
      <div style={{ padding: '16px 12px' }}>
        <button style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          backgroundColor: '#7C6FCD',
          color: 'white',
          borderRadius: '8px',
          padding: '10px 12px',
          fontSize: '11px',
          fontWeight: '700',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          border: 'none',
        }}>
          <Settings size={14} />
          Paramètres
        </button>
      </div>
    </aside>
  );
}
