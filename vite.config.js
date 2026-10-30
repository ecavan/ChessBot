import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { VitePWA } from 'vite-plugin-pwa';

// Cross-origin isolation lets Stockfish use several threads (SharedArrayBuffer).
const ISOLATION = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };

export default defineConfig({
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
        // The app and the puzzle packs are precached. The engine (its loader scripts and the
        // networks: lite ~7 MB, full 6 × 13 MB) is cached at runtime instead, under its own URL:
        // precaching would serve the loader from a `?__WB_REVISION__=…` URL, and a worker's
        // location is the URL it was served from, so Stockfish's thread workers (told apart by a
        // `#…,worker` fragment on the loader URL) would lose the fragment, each start as a whole
        // new engine and spawn threads of their own — a fork bomb that crashed the tab.
        globPatterns: ['**/*.{js,css,html,svg,png,json,webmanifest}'],
        globIgnores: ['**/stockfish/**'],
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.startsWith('/stockfish/'),
          handler: 'CacheFirst',
          options: { cacheName: 'stockfish-v2', expiration: { maxEntries: 40 } },
        }],
      },
    }),
  ],
});
