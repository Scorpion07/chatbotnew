// src/config.js
// Clean, final, conflict-free version

const ENV = import.meta.env || {};

// Detect origin (browser or fallback)
const runtimeOrigin =
  typeof window !== "undefined" && window.location
    ? window.location.origin
    : "http://127.0.0.1:5000";

// API base URL (should include /api)
export const API_BASE_URL = ENV.VITE_API_BASE_URL || "https://talk-sphere.com/api";

// Build full API URL
// Build API URL helper (does NOT add /api)
export const getApiUrl = (path = "") => {
  if (!path.startsWith("/")) path = "/" + path;
  return API_BASE_URL + path;
};

// Feature flags
export function isFeatureEnabled(flag) {
  if (!flag) return true;
  const v = ENV[`VITE_ENABLE_${flag.toUpperCase()}`];
  if (v === undefined || v === null) return true;
  return String(v).toLowerCase() === "true";
}

// Google client ID
export const GOOGLE_CLIENT_ID = ENV.VITE_GOOGLE_CLIENT_ID || "";

// Default config object (this is what App.jsx loads)
const config = {
  api: {
    baseUrl: API_BASE_URL,
    timeout: Number(ENV.VITE_API_TIMEOUT || 10000),
    endpoints: {
      auth: "/auth",
      bots: "/bots",
      usage: "/usage",
      conversations: "/conversations",
      openai: "/openai",
    },
  },
  auth: {
    googleClientId: GOOGLE_CLIENT_ID,
    tokenKey: ENV.VITE_TOKEN_KEY || "token",
  },
  app: {
    name: ENV.VITE_APP_NAME || "TalkSphere AI",
    version: ENV.VITE_APP_VERSION || "1.0.0",
    logo: {
      small: "/logo/logoo.png",
      large: "/logo/logoo.png",
      favicon: "/logo/logoo.png",
    },
  },
};

export default config;
