import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../../public',
    emptyOutDir: false
  },
  server: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3456',
        changeOrigin: true,
      },
      '/avatars': {
        target: 'http://localhost:3456',
        changeOrigin: true,
      },
      '/go': {
        target: 'http://localhost:3456',
        changeOrigin: true,
      },
      '/s': {
        target: 'http://localhost:3456',
        changeOrigin: true,
      },
      '/zalo-scan': {
        target: 'http://localhost:3456',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3456',
        ws: true,
      },
    },
  },
})

