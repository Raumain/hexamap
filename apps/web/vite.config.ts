import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    host: true, // écoute sur 0.0.0.0 (accessible depuis le LAN)
    port: 5174,
    strictPort: true,
    proxy: {
      // Le navigateur ne parle qu'à l'origine du web ; Vite relaye /api vers
      // l'API dans le réseau Docker (API_INTERNAL_URL résolue côté conteneur).
      '/api': {
        target: process.env.API_INTERNAL_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
      '/blasons': {
        target: process.env.API_INTERNAL_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
    watch: {
      usePolling: true,
    },
  },
});
