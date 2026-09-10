// NotifItem - une notification du panneau (story #121).
// Icone selon le type, couleur selon la gravite renvoyee par l'API (info,
// jaune, orange, rouge). Le clic marque la notification lue et ouvre l'ecran
// concerne, deja filtre par le lien fourni par l'API.
import {
  Bell, AlertTriangle, CheckCircle, XCircle, Clock, CalendarClock, PiggyBank, RefreshCw, Info,
} from 'lucide-react';
import { timeAgo } from '../../utils/dateUtils';

const TYPE_ICONS = {
  echeance_contrat: CalendarClock,
  echeance_souscription: CalendarClock,
  depassement_conformite: AlertTriangle,
  budget_seuil: PiggyBank,
  validation_en_attente: Clock,
  saisie_traitee: CheckCircle,
  revalidation_echue: RefreshCw,
};

const GRAVITE_COLORS = {
  info: 'text-blue-500',
  jaune: 'text-yellow-500',
  orange: 'text-orange-500',
  rouge: 'text-red-500',
};

function iconeDe(notif) {
  if (notif.type === 'saisie_traitee' && notif.gravite === 'orange') return XCircle;
  if (TYPE_ICONS[notif.type]) return TYPE_ICONS[notif.type];
  return notif.gravite === 'info' ? Info : Bell;
}

export default function NotifItem({ notif, onRead, onNavigate }) {
  const Icon = iconeDe(notif);
  const iconColor = GRAVITE_COLORS[notif.gravite] ?? 'text-gray-500';
  const lue = Boolean(notif.lu) || notif.statut === 'lu';

  function handleClick() {
    if (!lue) onRead(notif.id);
    if (notif.lien) onNavigate(notif.lien);
  }

  return (
    <div className={`relative flex gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors ${!lue ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''}`}>
      <button
        onClick={handleClick}
        className="flex gap-3 flex-1 min-w-0 text-left"
        aria-label={`${notif.titre || 'Notification'}${lue ? '' : ' (non lue)'}`}
      >
        <div className={`flex-shrink-0 mt-0.5 ${iconColor}`} aria-hidden="true">
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          {notif.titre && (
            <p className={`text-sm leading-snug ${!lue ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-800 dark:text-gray-200'}`}>
              {notif.titre}
            </p>
          )}
          <p className={`text-sm leading-snug mt-0.5 ${!lue ? 'text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>
            {notif.message}
          </p>
          <p className="text-xs text-gray-400 mt-1">{timeAgo(notif.created_at)}</p>
        </div>
      </button>
      {!lue && (
        <span className="absolute left-1.5 top-4 w-1.5 h-1.5 rounded-full bg-blue-500" aria-hidden="true" />
      )}
    </div>
  );
}
