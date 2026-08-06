// AuthContext - authentification réelle sur l'API (JWT access + refresh).
import { createContext, useState, useEffect, useCallback } from 'react';
import * as authService from '../services/authService';

export const AuthContext = createContext(null);

const EMPTY_STATE = {
  user: null,
  permissions: [],
  isTenantScope: false,
  isAuthenticated: false,
  isLoading: true,
};

export function AuthProvider({ children }) {
  const [state, setState] = useState(EMPTY_STATE);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const restored = await authService.bootstrapSession();
      if (cancelled) return;
      if (restored) {
        setState({
          user: restored.user,
          permissions: restored.droits.permissions,
          isTenantScope: restored.droits.isTenantScope,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        setState((s) => ({ ...s, isLoading: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const result = await authService.login(email, password);
    if (!result.success) return result;
    const [user, droits] = await Promise.all([authService.fetchMe(), authService.fetchMesDroits()]);
    setState({
      user,
      permissions: droits.permissions,
      isTenantScope: droits.isTenantScope,
      isAuthenticated: true,
      isLoading: false,
    });
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setState({ ...EMPTY_STATE, isLoading: false });
  }, []);

  const hasPermission = useCallback((code) => state.permissions.includes(code), [state.permissions]);
  const hasAnyPermission = useCallback(
    (codes) => codes.some((c) => state.permissions.includes(c)),
    [state.permissions]
  );

  return (
    <AuthContext.Provider value={{ ...state, login, logout, hasPermission, hasAnyPermission }}>
      {children}
    </AuthContext.Provider>
  );
}
