import.meta.env; // ensure Vite env works

const ENV = import.meta.env || {};

export const API_BASE_URL =
  ENV.VITE_API_BASE_URL ||
  (typeof window !== "undefined"
    ? `${window.location.origin}/api`
    : "http://127.0.0.1:5000/api");

export function getApiUrl(path = "") {
  if (!path.startsWith("/")) path = "/" + path;
  return API_BASE_URL.replace(/\/$/, "") + path;
}

export const FEATURES = {
  googleAuth: (ENV.VITE_ENABLE_GOOGLE_AUTH ?? "true") === "true",
  imageUpload: (ENV.VITE_ENABLE_IMAGE_UPLOAD ?? "true") === "true",
  voiceInput: (ENV.VITE_ENABLE_VOICE_INPUT ?? "true") === "true",
  premium: (ENV.VITE_ENABLE_PREMIUM ?? "true") === "true",
};

export function isFeatureEnabled(key) {
  return !!FEATURES[key];
}

export const config = {
  api: {
    baseUrl: API_BASE_URL,
    timeout: parseInt(ENV.VITE_API_TIMEOUT || "10000"),
    endpoints: {
      auth: "/auth",
      bots: "/bots",
      usage: "/usage",
      conversations: "/conversations",
      openai: "/openai",
    },
  },
  auth: {
    googleClientId: ENV.VITE_GOOGLE_CLIENT_ID || "",
    tokenKey: ENV.VITE_TOKEN_KEY || "token",
    loginRedirect: ENV.VITE_LOGIN_REDIRECT || "chat",
    logoutRedirect: ENV.VITE_LOGOUT_REDIRECT || "home",
  },
  app: {
    name: ENV.VITE_APP_NAME || "TalkSphere AI",
    version: ENV.VITE_APP_VERSION || "1.0.0",
    logo: {
      small: ENV.VITE_APP_LOGO_SMALL || "/logo/logoo.png",
      large: ENV.VITE_APP_LOGO_LARGE || "/logo/logoo.png",
      favicon: ENV.VITE_APP_FAVICON || "/logo/logoo.png",
      dark: ENV.VITE_APP_LOGO_DARK || "/logo/logoo.png",
    },
  },
  features: FEATURES,
};

export const GOOGLE_CLIENT_ID = config.auth.googleClientId;

export default config;
