import { http, setAccessToken, setRefreshToken, getRefreshToken, clearTokens } from './http';

export async function login(email, password) {
  try {
    const data = await http.post('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    return { success: true, user: data.user };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function logout() {
  const refreshToken = getRefreshToken();
  clearTokens();
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // déconnexion best-effort : la session locale est de toute façon effacée
  }
}

export function fetchMe() {
  return http.get('/auth/me');
}

export function fetchMesDroits() {
  return http.get('/auth/mes-droits');
}

// Au chargement de l'app : tente de restaurer une session à partir du refresh
// token persistant. Retourne null si aucune session valide n'est restaurable.
export async function bootstrapSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      return null;
    }
    const { accessToken } = await res.json();
    setAccessToken(accessToken);
    const [user, droits] = await Promise.all([fetchMe(), fetchMesDroits()]);
    return { user, droits };
  } catch {
    clearTokens();
    return null;
  }
}
