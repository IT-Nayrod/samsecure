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

// Un 403 sur une ressource accessoire ne doit pas condamner l'ecran entier :
// un utilisateur autorise a consulter les contrats mais pas les referentiels
// merite sa liste, pas une page d'erreur. La ressource principale d'un ecran,
// elle, garde son echec : sans elle la page n'a plus d'objet.
// A n'employer que sur les chargements groupes, jamais sur une action.
export function optionnel(promesse, defaut = []) {
  return promesse.catch((err) => {
    if (err instanceof ApiError && err.status === 403) {
      console.info('[droits] ressource accessoire refusee, ecran servi sans elle');
      return defaut;
    }
    throw err;
  });
}

export const http = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
  put: (path, body) => request(path, { method: 'PUT', body }),
};

// Envoi multipart. Le Content-Type n'est deliberement pas pose : le navigateur
// doit le calculer lui-meme pour y joindre la frontiere du FormData. Le corps
// n'est pas serialise en JSON, d'ou une fonction distincte de request().
// Le refresh sur 401 est rejoue une fois, comme ailleurs, mais le FormData est
// reutilisable tel quel puisqu'il n'a pas ete consomme par un premier envoi
// abouti.
async function requestForm(path, formData, { retry = true } = {}) {
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`/api${path}`, { method: 'POST', headers, body: formData });

  if (res.status === 401 && retry) {
    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
      }
      await refreshPromise;
    } catch {
      throw new SessionExpiredError();
    }
    return requestForm(path, formData, { retry: false });
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // pas de corps JSON
  }
  if (!res.ok) throw new ApiError(data?.error || 'Une erreur est survenue.', res.status);
  return data;
}

// Recuperation d'un fichier protege. Un lien <a href> ne conviendrait pas : le
// navigateur n'y joint pas l'en-tete Authorization et l'API repondrait 401.
// On telecharge donc avec le jeton, puis on expose un objet URL local que le
// lecteur natif du navigateur sait ouvrir. L'appelant doit liberer cette URL
// avec URL.revokeObjectURL quand il a fini.
async function requestBlob(path, { retry = true } = {}) {
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`/api${path}`, { headers });

  if (res.status === 401 && retry) {
    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
      }
      await refreshPromise;
    } catch {
      throw new SessionExpiredError();
    }
    return requestBlob(path, { retry: false });
  }

  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { /* corps non JSON */ }
    throw new ApiError(data?.error || 'Une erreur est survenue.', res.status);
  }
  return res.blob();
}

http.postForm = (path, formData) => requestForm(path, formData);
http.getBlob = (path) => requestBlob(path);
