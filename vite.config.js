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
      watch: {
        usePolling: true,
	interval: 1000
      },
      hmr: {
        protocol: 'wss',
        host: 'dev-samsecure.nayrod.fr',
        clientPort: 443
      }
    },
    build: {
      outDir: isStaging ? 'staging-dist' : 'dev-dist',
      emptyOutDir: true
    }
  }
})
