import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  build: {
    minify: false,        // ✅ fixes rendering-chunks freeze
    target: "esnext",
    chunkSizeWarningLimit: 3000,
  },

  server: {
    port: 5001,
    proxy: {
        '/api': {
          target: process.env.VITE_API_URL || 'https://talk-sphere.com/api',
          changeOrigin: true,
          secure: false,
        }
    }
  }
});
