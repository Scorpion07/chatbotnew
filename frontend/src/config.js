// ================================
// FINAL FIXED CONFIG.JS
// ================================

const ENV = import.meta.env;

// Base API (no double /api/api issue)
export const API_BASE_URL =
  ENV.VITE_API_BASE_URL || "http://127.0.0.1:5000/api";

// Build URL properly
export const getApiUrl = (endpoint = "") => {
  if (!endpoint.startsWith("/")) endpoint = "/" + endpoint;
  return `${API_BASE_URL}${endpoint}`;
};

// Clean endpoints
export const endpoints = {
  auth: "/auth",
  bots: "/bots",
  usage: "/usage",
  conversations: "/conversations",
  openaiChatStream: "/openai/chat/stream",
  openaiImage: "/openai/image",
  openaiTranscribe: "/openai/transcribe",
};

// Google OAuth
export const GOOGLE_CLIENT_ID =
  ENV.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_HERE";

export const GOOGLE_REDIRECT_URI =
  ENV.VITE_GOOGLE_REDIRECT_URI ||
  window.location.origin + "/google-auth";

// Feature flag helper (needed for Login/Signup)
export function isFeatureEnabled(flag) {
  const key = `VITE_ENABLE_${flag?.toUpperCase()}`;
  const envFlag = ENV[key];
  return envFlag === undefined ? true : envFlag === "true";
}

// Default export for compatibility
const config = {
  API_BASE_URL,
  endpoints,
  GOOGLE_CLIENT_ID,
  GOOGLE_REDIRECT_URI,
  auth: {
    tokenKey: "token",
    googleClientId: GOOGLE_CLIENT_ID
  }
};

export default config;
