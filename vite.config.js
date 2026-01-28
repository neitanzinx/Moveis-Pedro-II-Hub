import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
    watch: {
      // Ignorar pastas do WhatsApp Bot para evitar reloads desnecessários
      ignored: ['**/.wwebjs_auth/**', '**/.wwebjs_cache/**', '**/robo whatsapp agendamentos/**']
    },
    proxy: {
      '/api/nuvemfiscal': {
        target: 'https://api.nuvemfiscal.com.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nuvemfiscal/, ''),
        secure: true
      },
      '/api/nuvemfiscal-sandbox': {
        target: 'https://api.sandbox.nuvemfiscal.com.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nuvemfiscal-sandbox/, ''),
        secure: true
      },
      '/api/nuvemfiscal-s3': {
        target: 'https://api-nuvemfiscal.s3.sa-east-1.amazonaws.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nuvemfiscal-s3/, ''),
        secure: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), './src'),
    },
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json']
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
})