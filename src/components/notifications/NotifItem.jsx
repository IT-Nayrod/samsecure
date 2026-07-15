// NotifItem - Section 6 Specs UX v0.5
import { Bell, AlertTriangle, CheckCircle, Clock, X } from 'lucide-react';
import { timeAgo } from '../../utils/dateUtils';

const TYPE_ICONS = {
  contract_expiry: AlertTriangle,
  validation_request: Clock,
  validation_done: CheckCircle,
  budget_alert: AlertTriangle,
  renewal: Bell,
  compliance: AlertTriangle,
  system: Bell,
};

const TYPE_COLORS = {
  contract_expiry: 'text-orange-500',
  validation_request: 'text-blue-500',
  validation_done: 'text-green-500',
  budget_alert: 'text-red-500',
  renewal: 'text-purple-500',
  compliance: 'text-red-500',
  system: 'text-gray-500',
};

export default function NotifItem({ notif, onRead, onArchive, onNavigate }) {
  const Icon = TYPE_ICONS[notif.type] ?? Bell;
  const iconColor = TYPE_COLORS[notif.type] ?? 'text-gray-500';

  function handleClick() {
    onRead(notif.id);
    if (notif.link) onNavigate(notif.link);
  }

  return (
    <div className={`relative flex gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${!notif.read ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''}`}>
      <button onClick={handleClick} className="flex gap-3 flex-1 min-w-0 text-left">
        <div className={`flex-shrink-0 mt-0.5 ${iconColor}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-snug ${!notif.read ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
            {notif.message}
          </p>
          <p className="text-xs text-gray-400 mt-1">{timeAgo(notif.date)}</p>
        </div>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onArchive(notif.id); }}
        aria-label="Archiver"
        className="flex-shrink-0 p-1 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors self-start mt-0.5"
      >
        <X size={13} />
      </button>
      {!notif.read && (
        <span className="absolute left-1.5 top-4 w-1.5 h-1.5 rounded-full bg-blue-500" />
      )}
    </div>
  );
}
