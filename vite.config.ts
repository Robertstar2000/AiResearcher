import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isProd = mode === 'production'
  
  console.log('Vite Environment Variables:')
  console.log('Environment:', mode)
  console.log('VITE_GROQ_API_KEY:', env.VITE_GROQ_API_KEY ? 'exists' : 'missing')
  console.log('VITE_GROQ_API_URL:', env.VITE_GROQ_API_URL ? 'exists' : 'missing')

  return {
    define: {
      'import.meta.env': {
        VITE_GROQ_API_KEY: JSON.stringify(env.VITE_GROQ_API_KEY),
        VITE_GROQ_API_URL: JSON.stringify(env.VITE_GROQ_API_URL),
        PROD: isProd,
        DEV: !isProd,
        MODE: JSON.stringify(mode)
      },
      global: {},
    },
    plugins: [react()],
    base: '/',
    optimizeDeps: {
      exclude: ['fs', 'path', 'os', 'crypto'],
    },
    build: {
      rollupOptions: {
        external: ['fs', 'path', 'os', 'crypto'],
      },
      outDir: 'dist',
      assetsDir: 'assets',
      assetsInlineLimit: 4096
    },
    server: {
      port: 3100,
      host: true,
      proxy: {
        '/api': {
          target: env.VITE_GROQ_API_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      },
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
        'Access-Control-Allow-Credentials': 'true'
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        crypto: 'crypto-browserify',
      }
    }
  }
})
