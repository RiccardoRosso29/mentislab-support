import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa: il sito statico funziona da qualsiasi percorso (hosting statico, anteprima come artefatto)
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1500,
    // per l'anteprima Artifact serve un unico file JS (npm run build:artifact)
    ...(process.env.ARTIFACT ? { outDir: 'dist-artifact-src', rollupOptions: { output: { inlineDynamicImports: true } } } : {}),
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as never);
