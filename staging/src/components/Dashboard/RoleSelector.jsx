// RoleSelector — onglets Manager DSI | Financier | IT Ops
// Conçu pour fonctionner en mode "all tabs" (3 groupes visibles).
// À terme : si l'utilisateur n'appartient qu'à 1 groupe → pas d'onglets.
//            Si 2+ groupes → onglets des groupes concernés uniquement.
const ROLES = [
  { id: 'dsi',       label: 'Manager DSI' },
  { id: 'financier', label: 'Financier'   },
  { id: 'itops',     label: 'IT Ops'      },
];

export default function RoleSelector({ activeRole, onChange }) {
  return (
    <div style={{
      display: 'flex',
      gap: 4,
      padding: '3px',
      background: '#F0F0F5',
      borderRadius: 10,
      width: 'fit-content',
    }}>
      {ROLES.map(role => (
        <button
          key={role.id}
          onClick={() => onChange(role.id)}
          style={{
            padding: '6px 20px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: activeRole === role.id ? 600 : 400,
            border: 'none',
            cursor: 'pointer',
            background: activeRole === role.id ? '#FFFFFF' : 'transparent',
            color: activeRole === role.id ? '#1A1D23' : '#8B9099',
            boxShadow: activeRole === role.id ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          {role.label}
        </button>
      ))}
    </div>
  );
}
