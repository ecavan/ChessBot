import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

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
    })
  ],
});
