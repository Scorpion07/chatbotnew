
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Store bots/stats config under backend/data/config.json
const configPath = path.join(process.cwd(), 'data', 'config.json');

// Centralized configuration with secrets management
export const config = {
  // Server Configuration
  server: {
    port: process.env.PORT || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5001'
  },

  // Database Configuration
  database: {
    url: process.env.DATABASE_URL || 'sqlite:./data/database.sqlite'
  },

  // Security & Authentication
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'change-this-secret-in-production',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 8,
    tokenExpiry: process.env.TOKEN_EXPIRY || '30d'
  },

  // AI Service API Keys
  apiKeys: {
    openai: process.env.OPENAI_API_KEY || '',
    anthropic: process.env.ANTHROPIC_API_KEY || '',
    google: process.env.GOOGLE_API_KEY || '',
    deepai: process.env.DEEPAI_API_KEY || '',
    xai: process.env.X_API_KEY || '',
    stability: process.env.STABILITY_API_KEY || '',
    imagemagic: process.env.IMAGEMAGIC_API_KEY || '',
    serper: process.env.SERPER_API_KEY || '',
    serpapi: process.env.SERPAPI_API_KEY || ''
  },

  // Azure OpenAI (Optional)
  azure: {
    openaiEndpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
    openaiKey: process.env.AZURE_OPENAI_KEY || '',
    openaiVersion: process.env.AZURE_OPENAI_VERSION || '2023-12-01-preview'
  },

  // Application Settings
  app: {
    name: 'TalkSphere AI',
    version: '1.0.0',
    maxFileSize: process.env.MAX_FILE_SIZE || '10MB',
    rateLimit: {
      freeUserLimit: parseInt(process.env.FREE_USER_LIMIT) || 5,
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 86400000 // 24 hours
    }
  },

  // Feature Flags
  features: {
    googleAuth: process.env.ENABLE_GOOGLE_AUTH !== 'false',
    imageUpload: process.env.ENABLE_IMAGE_UPLOAD !== 'false',
    voiceInput: process.env.ENABLE_VOICE_INPUT !== 'false',
    premiumFeatures: process.env.ENABLE_PREMIUM !== 'false'
  }
};

// Validation functions
export function validateConfig() {
  const warnings = [];
  const errors = [];

  // Check critical secrets
  if (config.auth.jwtSecret === 'change-this-secret-in-production') {
    if (config.server.nodeEnv === 'production') {
      errors.push('JWT_SECRET must be changed in production!');
    } else {
      warnings.push('Using default JWT_SECRET for development');
    }
  }

  // Check API keys
  const missingKeys = [];
  Object.entries(config.apiKeys).forEach(([key, value]) => {
    if (!value) missingKeys.push(key.toUpperCase());
  });

  if (missingKeys.length > 0) {
    warnings.push(`Missing API keys: ${missingKeys.join(', ')}`);
  }

  return { warnings, errors };
}

// Get configuration value with fallback
export function getConfig(path, fallback = null) {
  const keys = path.split('.');
  let value = config;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return fallback;
    }
  }
  
  return value;
}

// Check if a feature is enabled
export function isFeatureEnabled(feature) {
  return getConfig(`features.${feature}`, false);
}

// Check if an API key is available
export function hasApiKey(service) {
  const key = getConfig(`apiKeys.${service}`);
  return key && key.length > 0;
}

// Original config functions for bots data
export async function readConfig() {
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { bots: [], stats: { totalChats: 0, activeBots: 0, usersOnline: 0 } };
  }
}

export async function writeConfig(cfg) {
  await fs.ensureDir(path.dirname(configPath));
  await fs.writeFile(configPath, JSON.stringify(cfg, null, 2));
  return cfg;
}

// Export specific config sections for convenience
export const serverConfig = config.server;
export const authConfig = config.auth;
export const apiKeys = config.apiKeys;
export const appConfig = config.app;
