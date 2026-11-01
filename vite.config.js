import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { VitePWA } from 'vite-plugin-pwa';

// Cross-origin isolation lets Stockfish use several threads (SharedArrayBuffer).
const ISOLATION = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };

export default defineConfig({
  define: { __BUILD__: JSON.stringify(`${(process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7)} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`) },
  server: { headers: ISOLATION },
  preview: { headers: ISOLATION },
  plugins: [
    react(),
    viteStaticCopy({
      targets: [{ src: 'node_modules/stockfish/src/stockfish-17.1-[!a]*', dest: 'stockfish' }],
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Chess Trainer',
        short_name: 'Chess',
        description: 'Play Stockfish, solve puzzles, train calculation and review your games. Works offline.',
        theme_color: '#07090d',
        background_color: '#07090d',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // The app and the puzzle packs are precached. The engine is special: Stockfish's thread
        // workers are told apart from the engine by a `#…,worker` fragment on the loader URL, and
        // a worker script that a service worker answers (from a cache, or even a pass-through
        // fetch) comes back without its fragment — so every thread would start as a whole new
        // engine and spawn threads of its own, a fork bomb that crashes the tab within a minute.
        // So the service worker never answers a worker-script request: the loaders come from the
        // network / HTTP cache (vercel.json makes them immutable for a year). The network files
        // (lite ~7 MB, full 6 × 13 MB) are plain fetches from inside the worker and are cached
        // at runtime for offline use.
        globPatterns: ['**/*.{js,css,html,svg,png,json,webmanifest}'],
        globIgnores: ['**/stockfish/**', '**/maia/**'],
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        runtimeCaching: [{
          urlPattern: ({ url, request }) => url.pathname.startsWith('/stockfish/') && !/\.js$/.test(url.pathname) && request.destination !== 'worker' && request.destination !== 'sharedworker' && request.destination !== 'script',
          handler: 'CacheFirst',
          options: { cacheName: 'stockfish-v3', expiration: { maxEntries: 40 } },
        }, {
          // the Maia nets (1.7 MB each): cached the first time a level is used, refreshed behind
          urlPattern: ({ url }) => url.pathname.startsWith('/maia/'),
          handler: 'StaleWhileRevalidate',
          options: { cacheName: 'maia-v1', expiration: { maxEntries: 12 } },
        }],
      },
    }),
  ],
});
