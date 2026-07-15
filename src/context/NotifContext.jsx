// NotifContext - Section 6 Specs UX v0.5
import { createContext, useState, useCallback } from 'react';
import { mockNotifications } from '../data/mockNotifications';

export const NotifContext = createContext(null);

export function NotifProvider({ children }) {
  const [notifications, setNotifications] = useState(mockNotifications);
  const unreadCount = notifications.filter(n => !n.read && !n.archived).length;

  const markRead = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const archive = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, archived: true, read: true } : n));
  }, []);

  return (
    <NotifContext.Provider value={{ notifications, unreadCount, markRead, markAllRead, archive }}>
      {children}
    </NotifContext.Provider>
  );
}
