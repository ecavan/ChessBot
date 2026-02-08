import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/stockfish/src/stockfish-17.1-lite-single-03e3232.js',
          dest: 'stockfish'
        },
        {
          src: 'node_modules/stockfish/src/stockfish-17.1-lite-single-03e3232.wasm',
          dest: 'stockfish'
        }
      ]
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icon.svg',
        'stockfish/stockfish-17.1-lite-single-03e3232.js',
        'stockfish/stockfish-17.1-lite-single-03e3232.wasm',
      ],
      manifest: {
        name: 'Chess Intuition Trainer',
        short_name: 'Chess Trainer',
        description: 'Practice chess openings, endgames, puzzles, and review your games — all offline.',
        theme_color: '#16213e',
        background_color: '#111827',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,wasm}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB for Stockfish WASM
      },
    }),
  ],
});
