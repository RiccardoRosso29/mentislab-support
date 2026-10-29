import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/geo': 'http://localhost:8000',
    },
  },
  build: { chunkSizeWarningLimit: 3000 },
})
