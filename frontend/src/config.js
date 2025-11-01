// Configuration file for frontend
export const config = {
  // Replace with your actual Google OAuth Client ID
  // Get it from: https://console.developers.google.com/apis/credentials
  GOOGLE_CLIENT_ID: "YOUR_GOOGLE_CLIENT_ID",
  
  // API base URL
  API_BASE_URL: "http://localhost:5000",
  
  // Other configuration
  APP_NAME: "TalkSphere AI",
  VERSION: "1.0.0"
};

// For development, you can use environment variables
if (import.meta.env.VITE_GOOGLE_CLIENT_ID) {
  config.GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
}

if (import.meta.env.VITE_API_BASE_URL) {
  config.API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
}

export default config;