import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const PORT = Number(process.env.PORT ?? 3001);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Source unique des catégories, partagée avec le back.
      '@shared': fileURLToPath(new URL('../server/src/shared.ts', import.meta.url)),
    },
  },
  server: {
    // En dev, proxy des appels API vers le process Hono.
    proxy: {
      '/api': `http://localhost:${PORT}`,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
