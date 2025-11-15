// ===============================
// FINAL PRODUCTION CONFIG.JS
// ===============================

// Read Vite environment variables
const ENV = import.meta.env;

// Determine API Base URL
// Priority:
// 1) VITE_API_BASE_URL (prod)
// 2) window.location.origin/api  (auto detect live domain)
// 3) localhost fallback (dev)
export const API_BASE_URL =
  ENV.VITE_API_BASE_URL ||
  (typeof window !== "undefined"
    ? `${window.location.origin}/api`
    : "http://127.0.0.1:5000/api");

// Build full API route safely
export const getApiUrl = (endpoint = "") => {
  if (!endpoint.startsWith("/")) endpoint = "/" + endpoint;
  return `${API_BASE_URL}${endpoint}`;
};

// Clean endpoint map (no double /api)
export const endpoints = {
  auth: "/auth",
  bots: "/bots",
  usage: "/usage",
  conversations: "/conversations",
  openaiChatStream: "/openai/chat/stream",
  openaiImage: "/openai/image",
  openaiTranscribe: "/openai/transcribe",
};

// ===============================
// GOOGLE AUTH CONFIG
// ===============================

// Must end with:  .apps.googleusercontent.com
export const GOOGLE_CLIENT_ID =
  ENV.VITE_GOOGLE_CLIENT_ID || "";

// Redirect URI for Google Identity Services
// Works for localhost & production
export const GOOGLE_REDIRECT_URI =
  ENV.VITE_GOOGLE_REDIRECT_URI ||
  (typeof window !== "undefined"
    ? `${window.location.origin}/google-auth`
    : "");

// ===============================
// APP CONFIG
// ===============================
const runtimeOrigin =
  typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "";

export const config = {
  api: { baseUrl: API_BASE_URL },
  auth: {
    googleClientId: GOOGLE_CLIENT_ID,
    tokenKey: "token",
  },
  app: {
    name: ENV.VITE_APP_NAME || "TalkSphere AI",
    version: ENV.VITE_APP_VERSION || "1.0.0",
    origin: runtimeOrigin,
  },
};

// Feature flags (optional)
export const isFeatureEnabled = (flag) => {
  const val = ENV[`VITE_ENABLE_${flag?.toUpperCase()}`];
  return val === undefined ? true : val === "true";
};

export default config;
