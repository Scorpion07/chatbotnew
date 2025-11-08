import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { terser } from "rollup-plugin-terser";

export default defineConfig({
  plugins: [
    react(),
    terser({
      format: { comments: false },
      compress: { defaults: true }
    })
  ],

  build: {
    minify: "terser",         // ✅ prevents "rendering chunks" freeze
    target: "esnext",
    chunkSizeWarningLimit: 2000
  },

  server: {
    port: 5001,
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
});
