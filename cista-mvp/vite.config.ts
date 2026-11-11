import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa: il sito statico funziona da qualsiasi percorso (hosting statico, anteprima come artefatto)
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1500 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as never);
