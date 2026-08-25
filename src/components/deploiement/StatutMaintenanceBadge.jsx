// StatutMaintenanceBadge - statut de maintenance d'une licence.
// Les 4 valeurs sont celles renvoyees par l'API (licences.js, STATUT_MAINTENANCE) :
// active / echue / arretee / aucune. Aucune n'est calculee ici.
import { ShieldOff } from 'lucide-react';
import Badge from '../ui/Badge';

export default function StatutMaintenanceBadge({ licence, compact = false }) {
  const s = licence?.statut_maintenance;
  if (!s || s === 'aucune') return compact ? null : <span className="text-xs text-gray-400">Sans maintenance</span>;
  if (s === 'active') return <Badge variant="success" label="Maintenance active" />;
  if (s === 'echue') return <Badge variant="warning" label={`Maintenance échue${licence.date_fin_maintenance ? ` le ${licence.date_fin_maintenance}` : ''}`} />;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
      <ShieldOff size={11} />
      Maintenance arrêtée{licence.date_arret_maintenance ? ` le ${licence.date_arret_maintenance}` : ''}
      {licence.version_figee_label ? ` - version figée ${licence.version_figee_label}` : ''}
    </span>
  );
}
