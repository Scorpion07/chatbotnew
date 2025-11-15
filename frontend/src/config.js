// ============================
// ============================
// FINAL CONFIG.JS (WORKING)
// ============================

const ENV = import.meta.env;

const runtimeOrigin =
  typeof window !== "undefined" && window.location
    ? window.location.origin
    : "";

const ENV = import.meta.env;

const runtimeOrigin =
  typeof window !== "undefined" && window.location
    ? window.location.origin
    : "";

// -----------------------------
// -----------------------------
// API BASE URL
// -----------------------------
export const API_BASE_URL =
  ENV.VITE_API_BASE_URL ||
  runtimeOrigin + "/api" ||
  "http://127.0.0.1:5000/api";

// Normalize full API URL builder
export const getApiUrl = (endpoint = "") => {
  if (!endpoint.startsWith("/")) endpoint = "/" + endpoint;
  return API_BASE_URL.replace(/\/$/, "") + endpoint;
};

export const API_BASE_URL =
  ENV.VITE_API_BASE_URL ||
  runtimeOrigin + "/api" ||
  "http://127.0.0.1:5000/api";

// Normalize full API URL builder
export const getApiUrl = (endpoint = "") => {
  if (!endpoint.startsWith("/")) endpoint = "/" + endpoint;
  return API_BASE_URL.replace(/\/$/, "") + endpoint;
};

// -----------------------------
// -----------------------------
// ENDPOINT MAP
// -----------------------------
export const endpoints = {
  auth: "/auth",
  bots: "/bots",
  usage: "/usage",
  conversations: "/conversations",
  openaiChatStream: "/openai/chat/stream",
  openaiImage: "/openai/image",
  openaiTranscribe: "/openai/transcribe",
};
export const endpoints = {
  auth: "/auth",
  bots: "/bots",
  usage: "/usage",
  conversations: "/conversations",
  openaiChatStream: "/openai/chat/stream",
  openaiImage: "/openai/image",
  openaiTranscribe: "/openai/transcribe",
};

// -----------------------------
// -----------------------------
// GOOGLE OAUTH
// -----------------------------
export const GOOGLE_CLIENT_ID =
  ENV.VITE_GOOGLE_CLIENT_ID || "";

export const GOOGLE_REDIRECT_URI =
  ENV.VITE_GOOGLE_REDIRECT_URI ||
  runtimeOrigin + "/google-auth";
export const GOOGLE_CLIENT_ID =
  ENV.VITE_GOOGLE_CLIENT_ID || "";

export const GOOGLE_REDIRECT_URI =
  ENV.VITE_GOOGLE_REDIRECT_URI ||
  runtimeOrigin + "/google-auth";

// -----------------------------
// -----------------------------
// FEATURE FLAGS
// -----------------------------
export const isFeatureEnabled = (flag) => {
  const key = `VITE_ENABLE_${flag?.toUpperCase()}`;
  const val = ENV[key];
  return val === undefined ? true : val === "true";
};

export const isFeatureEnabled = (flag) => {
  const key = `VITE_ENABLE_${flag?.toUpperCase()}`;
  const val = ENV[key];
  return val === undefined ? true : val === "true";
};

// -----------------------------
// -----------------------------
// APP CONFIG (FIXES YOUR ERROR)
// -----------------------------
export const config = {
  apiBase: API_BASE_URL,

  auth: {
    googleClientId: GOOGLE_CLIENT_ID,
    tokenKey: "token",
    loginRedirect: "chat",
    logoutRedirect: "home",
  },
  app: {
    name: ENV.VITE_APP_NAME || "TalkSphere AI",
    version: ENV.VITE_APP_VERSION || "1.0.0",
  description: "Your unified AI workspace",

  // REQUIRED by App.jsx — prevents crash!
    logo: {
      small: "/logo/logoo.png",
      large: "/logo/logoo.png",
      favicon: "/logo/logoo.png",
      dark: "/logo/logoo.png",
    },
  },
};

export default config;
export const config = {
  apiBase: API_BASE_URL,

  auth: {
    googleClientId: GOOGLE_CLIENT_ID,
    tokenKey: "token",
    loginRedirect: "chat",
    logoutRedirect: "home",
  },

  app: {
    name: ENV.VITE_APP_NAME || "TalkSphere AI",
    version: ENV.VITE_APP_VERSION || "1.0.0",
    description: "Your unified AI workspace",

    // REQUIRED by App.jsx — prevents crash!
    logo: {
      small: "/logo/logoo.png",
      large: "/logo/logoo.png",
      favicon: "/logo/logoo.png",
      dark: "/logo/logoo.png",
    },
  },
};

export default config;
