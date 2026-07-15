// AuthContext - Section 2 Specs UX v0.5
import { createContext, useState, useEffect, useCallback } from 'react';
import { mockUsers } from '../data/mockUsers';

const MOCK_CREDENTIALS = {
  'admin@demo.fr': { password: 'Admin1234!', userId: '1', profil: 'manager_dsi' },
  'financier@demo.fr': { password: 'User1234!', userId: '2', profil: 'financier' },
  'itops@demo.fr': { password: 'User1234!', userId: '3', profil: 'it_ops' },
};

const SESSION_KEY = 'ss_session';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    user: null, profil: null, societe: null, isAuthenticated: false, isLoading: true,
  });

  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        setState({ ...JSON.parse(saved), isLoading: false });
      } catch {
        setState(s => ({ ...s, isLoading: false }));
      }
    } else {
      setState(s => ({ ...s, isLoading: false }));
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const cred = MOCK_CREDENTIALS[email.toLowerCase().trim()];
    if (!cred || cred.password !== password) return { success: false, error: 'Identifiants incorrects.' };
    const user = mockUsers.find(u => u.id === cred.userId);
    if (!user || !user.actif) return { success: false, error: 'Compte désactivé.' };
    const firstHab = user.habilitations[0];
    const session = {
      user, profil: firstHab.profil,
      societe: { id: firstHab.societe_id, raison_sociale: firstHab.societe_label },
      isAuthenticated: true, isLoading: false,
    };
    setState(session);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setState({ user: null, profil: null, societe: null, isAuthenticated: false, isLoading: false });
  }, []);

  const switchProfil = useCallback((profilCode) => {
    if (!state.user) return;
    const hab = state.user.habilitations.find(h => h.profil === profilCode);
    if (!hab) return;
    const updated = { ...state, profil: profilCode, societe: { id: hab.societe_id, raison_sociale: hab.societe_label } };
    setState(updated);
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
  }, [state]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, switchProfil }}>
      {children}
    </AuthContext.Provider>
  );
}
