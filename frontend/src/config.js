// ===============================
// FINAL FIXED CONFIG.JS
// ===============================

const ENV = import.meta.env;

// BASE API URL (No auto-append of /api/api)
export const API_BASE_URL =
  ENV.VITE_API_BASE_URL || "https://talk-sphere.com/api";

// Build correct API route
export const getApiUrl = (endpoint = "") => {
  if (!endpoint.startsWith("/")) endpoint = "/" + endpoint;
  return `${API_BASE_URL}${endpoint}`;
};

// Backend endpoints (NO DOUBLE /api)
export const endpoints = {
  auth: "/auth",
  bots: "/bots",
  usage: "/usage",
  conversations: "/conversations",
  openaiChatStream: "/openai/chat/stream",
  openaiImage: "/openai/image",
  openaiTranscribe: "/openai/transcribe"
};

// Google login
export const GOOGLE_CLIENT_ID =
  ENV.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_HERE";

export const GOOGLE_REDIRECT_URI =
  ENV.VITE_GOOGLE_REDIRECT_URI ||
  `${window.location.origin}/google-auth`;

// ===============================
// FIXED APP CONFIG (DO NOT REMOVE)
// ===============================
const config = {
  api: {
    baseUrl: API_BASE_URL,
    endpoints,
    timeout: 15000
  },

  auth: {
    googleClientId: GOOGLE_CLIENT_ID,
    tokenKey: "token",
  },

  app: {
    name: ENV.VITE_APP_NAME || "TalkSphere AI",
    version: ENV.VITE_APP_VERSION || "1.0.0",

    // ⭐ REQUIRED — prevents your crash
    logo: {
      small: "/logo/logoo.png",
      large: "/logo/logoo.png",
      favicon: "/logo/logoo.png",
      dark: "/logo/logoo.png"
    }
  }
};

export default config;
