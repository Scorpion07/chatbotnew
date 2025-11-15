// ======================================================
// FRONTEND CONFIG — CLEAN + FIXED (NO DOUBLE /api/api)
// ======================================================

// Detect base URL from browser OR fallback to your domain
const runtimeBaseUrl =
  (typeof window !== "undefined" &&
    window.location &&
    window.location.origin)
    ? window.location.origin
    : undefined;

export const config = {
  api: {
    // Final base URL (NO /api here)
    baseUrl: import.meta.env.VITE_API_URL || runtimeBaseUrl || "https://talk-sphere.com",

    timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 10000,
  },

  auth: {
    googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    tokenKey: "token",
    loginRedirect: "chat",
    logoutRedirect: "home"
  },

  app: {
    name: import.meta.env.VITE_APP_NAME || "TalkSphere AI",
    version: import.meta.env.VITE_APP_VERSION || "1.0.0",
    description: "Access GPT-4, Claude, Gemini, and more from one beautiful interface",

    logo: {
      small: "/logo/logoo.png",
      large: "/logo/logoo.png",
      favicon: "/logo/logoo.png",
      dark: import.meta.env.VITE_APP_LOGO_DARK || "/logo/logoo.png"
    }
  }
};

// ======================================================
// ALWAYS produces: https://talk-sphere.com/api/<endpoint>
// NEVER produces: https://talk-sphere.com/api/api/<endpoint>
// ======================================================
export function getApiUrl(path = "") {
  const base = config.api.baseUrl.replace(/\/$/, ""); // remove trailing slash

  // Ensure single `/api`
  const cleanPath = path.replace(/^\/+/, ""); // remove leading slash

  return `${base}/api/${cleanPath}`;
}

// Feature flags
export function isFeatureEnabled(flag) {
  const envFlag = import.meta.env[`VITE_ENABLE_${flag?.toUpperCase()}`];
  return envFlag === undefined ? true : envFlag === "true";
}

export default config;
