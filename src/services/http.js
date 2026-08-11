// http - client HTTP unique : porte le token, le refresh transparent et la
// normalisation des erreurs. Aucun composant ne doit appeler fetch() directement.

const REFRESH_KEY = 'ss_refresh_token';

let accessToken = null;
let refreshPromise = null;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export class SessionExpiredError extends Error {
  constructor() {
    super('Votre session a expiré. Veuillez vous reconnecter.');
    this.name = 'SessionExpiredError';
  }
}

export function setAccessToken(token) {
  accessToken = token;
}

export function setRefreshToken(token) {
  if (token) localStorage.setItem(REFRESH_KEY, token);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function clearTokens() {
  accessToken = null;
  localStorage.removeItem(REFRESH_KEY);
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new SessionExpiredError();

  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    clearTokens();
    throw new SessionExpiredError();
  }
  const data = await res.json();
  accessToken = data.accessToken;
  return accessToken;
}

async function request(path, { method = 'GET', body, retry = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry) {
    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      await refreshPromise;
    } catch {
      throw new SessionExpiredError();
    }
    return request(path, { method, body, retry: false });
  }

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    // pas de corps JSON (ex: erreur réseau brute)
  }

  if (!res.ok) {
    throw new ApiError(data?.error || 'Une erreur est survenue.', res.status);
  }
  return data;
}

export const http = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
