import config from '../config.js';

export function getToken() {
  try {
    return localStorage.getItem(config.auth.tokenKey) || null;
  } catch {
    return null;
  }
}

export function getUser() {
  try {
    const raw = localStorage.getItem(config.auth.userKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuth({ token, user }) {
  try {
    if (token) localStorage.setItem(config.auth.tokenKey, token);
    if (user) localStorage.setItem(config.auth.userKey, JSON.stringify(user));
  } catch {}
}

export function clearAuth() {
  try {
    localStorage.removeItem(config.auth.tokenKey);
    localStorage.removeItem(config.auth.userKey);
  } catch {}
}

// Convenience for building headers
export function authHeader() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
