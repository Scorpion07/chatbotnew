export const GOOGLE_REDIRECT_URI =
  import.meta.env.VITE_GOOGLE_REDIRECT_URI ||
  window.location.origin + "/google-auth";

// frontend/src/config.js
const ENV = import.meta.env || {};

// runtime origin fallback for dev builds (Vite)
const runtimeOrigin =
  (typeof window !== 'undefined' && window.location && window.location.origin)
    ? window.location.origin
    : 'http://127.0.0.1:5173';

// API base: prefer explicit env, then current origin (dev), then production host
export const API_BASE_URL =
  ENV.VITE_API_BASE_URL ||
  (runtimeOrigin.endsWith('/') ? runtimeOrigin.slice(0, -1) : runtimeOrigin) + '/api' ||
  'https://talk-sphere.com/api';

// helper to build API URLs robustly (no double slashes)
export function getApiUrl(path = '') {
  const base = String(API_BASE_URL).replace(/\/$/, '');
  if (!path) return base;
  return base + (path.startsWith('/') ? path : '/' + path);
}

// Google client id and redirect URI (front-end)
export const GOOGLE_CLIENT_ID = ENV.VITE_GOOGLE_CLIENT_ID || ENV.VITE_GOOGLE_CLIENT || '';


export function isFeatureEnabled(key) {
  return FEATURES[key] === true;
}

// full runtime config object used across the app
const config = {
  api: {
    baseUrl: API_BASE_URL,
    timeout: parseInt(ENV.VITE_API_TIMEOUT || '10000', 10),
    endpoints: {
      auth: '/auth',
      bots: '/bots',
      usage: '/usage',
      conversations: '/conversations',
      openai: '/openai',
      stats: '/stats'
    }
  },
  auth: {
    // NOTE: front-end expects config.auth.googleClientId (string) and config.auth.tokenKey
    googleClientId: GOOGLE_CLIENT_ID,
    tokenKey: ENV.VITE_TOKEN_KEY || 'token',
    loginRedirect: ENV.VITE_LOGIN_REDIRECT || 'chat',
    logoutRedirect: ENV.VITE_LOGOUT_REDIRECT || 'home'
  },
  app: {
    name: ENV.VITE_APP_NAME || 'TalkSphere AI',
    version: ENV.VITE_APP_VERSION || '1.0.0',
    logo: {
      small: ENV.VITE_APP_LOGO_SMALL || '/logo/logoo.png',
      large: ENV.VITE_APP_LOGO_LARGE || '/logo/logoo.png',
      favicon: ENV.VITE_APP_FAVICON || '/logo/logoo.png',
    }
  }
};

export default config;
