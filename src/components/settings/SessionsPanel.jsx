// SessionsPanel - Section 4 Specs UX v0.5
import { useState } from 'react';
import { Monitor, Smartphone, Trash2 } from 'lucide-react';
import { mockSessions } from '../../data/mockUsers';
import { timeAgo } from '../../utils/dateUtils';
import Button from '../ui/Button';
import { useToast } from '../../hooks/useToast';

function DeviceIcon({ appareil }) {
  const isMobile = /mobile|safari.*ios|android/i.test(appareil);
  return isMobile ? <Smartphone size={16} className="text-gray-400" /> : <Monitor size={16} className="text-gray-400" />;
}

export default function SessionsPanel() {
  const { addToast } = useToast();
  const [sessions, setSessions] = useState(mockSessions);

  function revoke(id) {
    setSessions(prev => prev.filter(s => s.id !== id));
    addToast({ type: 'info', message: 'Session révoquée.' });
  }

  function revokeAll() {
    setSessions(prev => prev.filter(s => s.current));
    addToast({ type: 'info', message: 'Toutes les autres sessions ont été déconnectées.' });
  }

  const others = sessions.filter(s => !s.current);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sessions actives</h3>
        {others.length > 0 && (
          <Button variant="destructive" size="sm" onClick={revokeAll}>
            Déconnecter toutes les autres sessions
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {sessions.map(session => (
          <div key={session.id} className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600">
            <DeviceIcon appareil={session.appareil} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{session.appareil}</p>
                {session.current && (
                  <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Session actuelle</span>
                )}
              </div>
              <p className="text-xs text-gray-500">{session.ip} · {timeAgo(session.derniere_activite)}</p>
            </div>
            {!session.current && (
              <button
                onClick={() => revoke(session.id)}
                aria-label="Révoquer la session"
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
