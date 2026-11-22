import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      // Le manifeste est un fichier statique de `public/`, pas une option Vite.
      registerType: 'prompt',
      injectRegister: false,
      // Phase 43 « La Sonnette » : le worker est écrit à la main pour porter les
      // gestionnaires `push` et `notificationclick`. `generateSW` ne savait pas
      // les produire.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifest: false,
      injectManifest: {
        // `navigateFallback` exige que `/index.html` soit précaché : Workbox lève
        // `non-precached-url` à l'installation sinon, et aucun service worker ne
        // s'active. L'ancienne exclusion `**/index.html` rendait le fichier
        // introuvable dans le manifeste de précache.
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,ico,webmanifest}'],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    // La découpe des routes est déjà portée par `autoCodeSplitting` : ce qui
    // reste dans le chunk d'entrée est du code fournisseur, isolé ici par famille.
    rollupOptions: {
      output: {
        manualChunks: (id: string): string | undefined => {
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/scheduler/')
          ) {
            return 'vendor-react';
          }
          if (id.includes('/node_modules/@tanstack/')) {
            return 'vendor-tanstack';
          }
          if (
            id.includes('/node_modules/@elysia/eden/') ||
            id.includes('/node_modules/better-auth/') ||
            id.includes('/node_modules/@better-auth/')
          ) {
            return 'vendor-eden';
          }
          return undefined;
        },
      },
    },
    // Plafond d'acceptation de la phase : aucun chunk ne doit le dépasser.
    chunkSizeWarningLimit: 500,
  },
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
