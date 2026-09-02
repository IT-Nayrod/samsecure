// NotifContext - notifications reelles de l'utilisateur connecte (story #121).
// Remplace le mock fige de la v0.5 : le compteur de la cloche est lu a la
// connexion puis toutes les 60 secondes, le panneau charge la liste a
// l'ouverture (non lues ou toutes), les actions passent par l'API et le
// compteur renvoye par chaque reponse fait foi.
import { createContext, useState, useCallback, useEffect, useRef } from 'react';
import useAuth from '../hooks/useAuth';
import { notificationsService } from '../services/notificationsService';

export const NotifContext = createContext(null);

const INTERVALLE_COMPTEUR_MS = 60000;
const LIMITE_PANNEAU = 100;

export function NotifProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  // inactif | chargement | pret | erreur
  const [etat, setEtat] = useState('inactif');
  const [erreur, setErreur] = useState(null);
  const chargementEnCours = useRef(0);

  const rafraichirCompteur = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const r = await notificationsService.compteur();
      setUnreadCount(Number(r?.non_lues) || 0);
    } catch {
      // Silencieux : la cloche garde sa derniere valeur, le prochain passage
      // la corrigera. Une session expiree est traitee par http.js.
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      setNotifications([]);
      setEtat('inactif');
      return undefined;
    }
    rafraichirCompteur();
    const minuterie = setInterval(rafraichirCompteur, INTERVALLE_COMPTEUR_MS);
    return () => clearInterval(minuterie);
  }, [isAuthenticated, rafraichirCompteur]);

  // lu : false pour les non lues seules, undefined pour toutes.
  const charger = useCallback(async ({ lu } = {}) => {
    const jeton = chargementEnCours.current + 1;
    chargementEnCours.current = jeton;
    setEtat('chargement');
    setErreur(null);
    try {
      const r = await notificationsService.liste({ lu, limite: LIMITE_PANNEAU });
      if (chargementEnCours.current !== jeton) return;
      setNotifications(r?.notifications ?? []);
      setUnreadCount(Number(r?.non_lues) || 0);
      setEtat('pret');
    } catch (e) {
      if (chargementEnCours.current !== jeton) return;
      setErreur(e?.message || 'Les notifications n\'ont pas pu être chargées.');
      setEtat('erreur');
    }
  }, []);

  const markRead = useCallback(async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, lu: true, statut: 'lu' } : n)));
    try {
      const r = await notificationsService.marquerLu(id);
      if (r && r.non_lues !== undefined) setUnreadCount(Number(r.non_lues) || 0);
    } catch {
      rafraichirCompteur();
    }
  }, [rafraichirCompteur]);

  const markAllRead = useCallback(async () => {
    try {
      await notificationsService.toutLu();
      setNotifications((prev) => prev.map((n) => ({ ...n, lu: true, statut: 'lu' })));
      setUnreadCount(0);
      return true;
    } catch (e) {
      setErreur(e?.message || 'Le marquage n\'a pas pu être enregistré.');
      return false;
    }
  }, []);

  return (
    <NotifContext.Provider value={{
      notifications, unreadCount, etat, erreur,
      charger, rafraichirCompteur, markRead, markAllRead,
    }}>
      {children}
    </NotifContext.Provider>
  );
}
