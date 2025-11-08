import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  build: {
    minify: "terser",        // ✅ fixes rendering-chunks freeze
    target: "esnext",
    chunkSizeWarningLimit: 3000,
  },

  server: {
    port: 5001,
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
});
