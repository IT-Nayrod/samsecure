// NotifDrawer - panneau des notifications (story #121).
// Deux onglets, Non lues et Toutes, charges depuis l'API a l'ouverture et a
// chaque changement d'onglet. Etats : chargement, vide, erreur (avec reprise).
// Le clic sur une notification la marque lue et ouvre l'ecran concerne ;
// "Tout marquer comme lu" passe par l'API.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Loader2, RefreshCw } from 'lucide-react';
import useNotifications from '../../hooks/useNotifications';
import NotifItem from './NotifItem';
import Button from '../ui/Button';

const TABS = [
  { label: 'Non lues', filtre: { lu: false } },
  { label: 'Toutes', filtre: {} },
];

export default function NotifDrawer({ isOpen, onClose }) {
  const { notifications, unreadCount, etat, erreur, charger, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [marquage, setMarquage] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) charger(TABS[tab].filtre);
  }, [isOpen, tab, charger]);

  function handleNavigate(lien) {
    navigate(lien);
    onClose();
  }

  async function handleMarkAll() {
    setMarquage(true);
    const ok = await markAllRead();
    setMarquage(false);
    if (ok) charger(TABS[tab].filtre);
  }

  // Sur l'onglet Non lues, une notification lue dans le panneau reste
  // affichee jusqu'au prochain chargement : le rechargement se fait a
  // l'ouverture suivante, pas sous la main de l'utilisateur.
  const liste = notifications;

  let contenu;
  if (etat === 'chargement' && liste.length === 0) {
    contenu = (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-2 text-gray-400">
        <Loader2 size={20} className="animate-spin" aria-hidden="true" />
        <p className="text-sm">Chargement des notifications…</p>
      </div>
    );
  } else if (etat === 'erreur') {
    contenu = (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
        <p className="text-sm text-red-600 dark:text-red-400">{erreur || 'Les notifications n\'ont pas pu être chargées.'}</p>
        <Button variant="secondary" size="sm" onClick={() => charger(TABS[tab].filtre)}>
          <RefreshCw size={13} aria-hidden="true" /> Réessayer
        </Button>
      </div>
    );
  } else if (liste.length === 0) {
    contenu = (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <p className="text-sm text-gray-400">
          {tab === 0 ? 'Aucune notification non lue.' : 'Aucune notification.'}
        </p>
      </div>
    );
  } else {
    contenu = (
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {liste.map((notif) => (
          <NotifItem
            key={notif.id}
            notif={notif}
            onRead={markRead}
            onNavigate={handleNavigate}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/30 z-30" onClick={onClose} />}
      <div
        role="dialog"
        aria-label="Notifications"
        aria-hidden={!isOpen}
        className={`fixed top-0 right-0 h-full w-[380px] max-w-full bg-white dark:bg-gray-800 shadow-2xl z-40 flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* En-tete */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Notifications</h2>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleMarkAll} isLoading={marquage} className="text-xs">
                Tout marquer comme lu
              </Button>
            )}
            <button onClick={onClose} aria-label="Fermer" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 flex-shrink-0" role="tablist">
          {TABS.map((t, i) => (
            <button
              key={t.label}
              role="tab"
              aria-selected={tab === i}
              onClick={() => setTab(i)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === i ? 'text-blue-700 border-b-2 border-blue-700 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            >
              {t.label}{i === 0 && unreadCount > 0 ? ` (${unreadCount})` : ''}
            </button>
          ))}
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto">
          {contenu}
        </div>

        {etat === 'chargement' && liste.length > 0 && (
          <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Actualisation…
          </div>
        )}
      </div>
    </>
  );
}
