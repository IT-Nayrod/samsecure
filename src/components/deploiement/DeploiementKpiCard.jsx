// DeploiementKpiCard - carte KPI d'en-tete, reutilisee par Licences, Affectations, Inventaire, Contrats, Commandes et Factures
export default function DeploiementKpiCard({ label, value, color = '#1A1D23', icon: Icon, onClick, active = false }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`flex items-center gap-3 bg-white dark:bg-gray-800 border rounded-xl p-4 text-left ${onClick ? 'hover:border-blue-300 transition-colors cursor-pointer' : ''} ${active ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 dark:border-gray-700'}`}
    >
      {Icon && (
        <span className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0" style={{ backgroundColor: `${color}18` }}>
          <Icon size={17} style={{ color }} />
        </span>
      )}
      <div>
        <p className="text-xl font-semibold text-gray-900 dark:text-white" style={{ color }}>{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </Tag>
  );
}
