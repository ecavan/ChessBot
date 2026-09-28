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
        // the app and the puzzle packs are precached; the engine networks (lite ~7 MB, full
        // 6 × 13 MB) are cached the first time they load
        globPatterns: ['**/*.{js,css,html,svg,png,json,webmanifest}'],
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.startsWith('/stockfish/') && url.pathname.endsWith('.wasm'),
          handler: 'CacheFirst',
          options: { cacheName: 'stockfish-wasm', expiration: { maxEntries: 20 } },
        }],
      },
    }),
  ],
});
