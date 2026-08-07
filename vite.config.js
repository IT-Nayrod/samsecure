import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const isStaging = mode === 'staging'

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      origin: 'https://dev-samsecure.nayrod.fr',
      proxy: {
	'/api': { target: 'http://127.0.0.1:3002', changeOrigin: true }
      },
      watch: {
        usePolling: true,
	interval: 1000,
        ignored: ['**/staging-dist/**', '**/staging-dist-*/**', '**/dist/**', '**/planning/**', '**/bdd/**']
      },
      hmr: {
        protocol: 'wss',
        clientPort: 443
      }
    },
    build: {
      outDir: isStaging ? 'staging-dist' : 'dev-dist',
      emptyOutDir: true
    }
  }
})
