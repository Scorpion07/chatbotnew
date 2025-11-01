// Configuration file for frontend
export const config = {
  // API Configuration
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000",
    timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 10000,
    endpoints: {
      auth: "/api/auth",
      bots: "/api/bots",
      openai: "/api/openai",
      stats: "/api/stats",
      usage: "/api/usage"
    }
  },

  // Authentication Configuration
  auth: {
    googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || "PASTE_YOUR_GOOGLE_CLIENT_ID_HERE",
    tokenKey: "token",
    loginRedirect: "chat",
    logoutRedirect: "home"
  },

  // Application Configuration
  app: {
    name: import.meta.env.VITE_APP_NAME || "TalkSphere AI",
    version: import.meta.env.VITE_APP_VERSION || "1.0.0",
    description: "Access GPT-4, Claude, Gemini, and more from one beautiful interface",
    logo: {
      small: "/logos/logo.png",
      large: "/logos/logo-large.png",
      favicon: "/logos/favicon.png"
    }
  },

  // Feature Flags
  features: {
    googleAuth: import.meta.env.VITE_ENABLE_GOOGLE_AUTH !== "false",
    darkMode: import.meta.env.VITE_ENABLE_DARK_MODE !== "false",
    voiceInput: import.meta.env.VITE_ENABLE_VOICE_INPUT !== "false",
    imageUpload: import.meta.env.VITE_ENABLE_IMAGE_UPLOAD !== "false",
    premium: import.meta.env.VITE_ENABLE_PREMIUM !== "false",
    analytics: import.meta.env.VITE_ENABLE_ANALYTICS === "true"
  },

  // UI Configuration
  ui: {
    theme: {
      primary: "indigo",
      secondary: "purple",
      success: "green",
      warning: "yellow",
      error: "red"
    },
    animations: import.meta.env.VITE_ENABLE_ANIMATIONS !== "false",
    transitions: import.meta.env.VITE_ENABLE_TRANSITIONS !== "false"
  },

  // Limits and Constraints
  limits: {
    freeUserQueries: parseInt(import.meta.env.VITE_FREE_USER_LIMIT) || 5,
    maxFileSize: import.meta.env.VITE_MAX_FILE_SIZE || "10MB",
    maxMessageLength: parseInt(import.meta.env.VITE_MAX_MESSAGE_LENGTH) || 4000,
    rateLimitWindow: parseInt(import.meta.env.VITE_RATE_LIMIT_WINDOW) || 86400000
  },

  // Development/Debug Configuration
  debug: {
    enabled: import.meta.env.DEV || import.meta.env.VITE_DEBUG === "true",
    showApiCalls: import.meta.env.VITE_DEBUG_API === "true",
    showStateChanges: import.meta.env.VITE_DEBUG_STATE === "true"
  }
};

// Validation functions
export function validateConfig() {
  const warnings = [];
  const errors = [];

  // Check Google Client ID
  if (config.features.googleAuth && config.auth.googleClientId === "YOUR_GOOGLE_CLIENT_ID") {
    warnings.push("Google Sign-In is enabled but CLIENT_ID is not configured");
  }

  // Check API base URL
  if (!config.api.baseUrl || config.api.baseUrl.includes("localhost")) {
    if (import.meta.env.PROD) {
      warnings.push("Using localhost API URL in production build");
    }
  }

  return { warnings, errors };
}

// Utility functions
export function getApiUrl(endpoint = "") {
  const baseUrl = config.api.baseUrl.replace(/\/$/, "");
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${baseUrl}${path}`;
}

export function isFeatureEnabled(feature) {
  return config.features[feature] || false;
}

export function getThemeColor(color) {
  return config.ui.theme[color] || color;
}

export function isDebugMode() {
  return config.debug.enabled;
}

// Legacy support - keep these for backward compatibility
export const GOOGLE_CLIENT_ID = config.auth.googleClientId;
export const API_BASE_URL = config.api.baseUrl;
export const APP_NAME = config.app.name;
export const VERSION = config.app.version;

export default config;