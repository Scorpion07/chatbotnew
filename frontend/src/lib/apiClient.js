import axios from 'axios';
import config, { getApiUrl } from '../config.js';
import { getToken, clearAuth } from './auth.js';

// Single axios instance for the app
export const api = axios.create({
  baseURL: config.api.baseUrl,
  timeout: config.api.timeout,
});

// Request: attach Authorization header if token exists
api.interceptors.request.use((req) => {
  const token = getToken();
  if (token) {
    req.headers = req.headers || {};
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

// Response: handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      // Clear local auth and notify app to redirect
      clearAuth();
      try {
        window.dispatchEvent(new CustomEvent('auth:logout'));
      } catch {}
    }
    return Promise.reject(error);
  },
);

// Helper for fetch-based endpoints (e.g., streaming) with auth header
export async function fetchWithAuth(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const url = getApiUrl(path);
  return fetch(url, { ...options, headers });
}

export default api;
