// NotifDrawer - Section 6 Specs UX v0.5
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import useNotifications from '../../hooks/useNotifications';
import NotifItem from './NotifItem';
import Button from '../ui/Button';

const TABS = ['Non lues', 'Toutes', 'Archivées'];

export default function NotifDrawer({ isOpen, onClose }) {
  const { notifications, unreadCount, markRead, markAllRead, archive } = useNotifications();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  function handleNavigate(link) {
    navigate(link);
    onClose();
  }

  const filtered = notifications.filter(n => {
    if (tab === 0) return !n.read && !n.archived;
    if (tab === 1) return !n.archived;
    return n.archived;
  });

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/30 z-30" onClick={onClose} />}
      <div className={`fixed top-0 right-0 h-full w-[380px] max-w-full bg-white dark:bg-gray-800 shadow-2xl z-40 flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Notifications</h2>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs">
                Tout marquer comme lu
              </Button>
            )}
            <button onClick={onClose} aria-label="Fermer" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === i ? 'text-blue-700 border-b-2 border-blue-700 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            >
              {t}{i === 0 && unreadCount > 0 ? ` (${unreadCount})` : ''}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <p className="text-sm text-gray-400">Aucune notification</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map(notif => (
                <NotifItem
                  key={notif.id}
                  notif={notif}
                  onRead={markRead}
                  onArchive={archive}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
