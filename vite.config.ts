import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProd = mode === 'production'
  
  console.log('Vite Environment Variables:')
  console.log('Environment:', mode)
  console.log('VITE_GROQ_API_KEY:', env.VITE_GROQ_API_KEY ? 'exists' : 'missing')
  console.log('VITE_GROQ_API_URL:', env.VITE_GROQ_API_URL ? 'exists' : 'missing')

  return {
    plugins: [
      react(),
      nodePolyfills({
        include: ['path', 'crypto', 'stream', 'util'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],
    define: {
      'process.env': env,
      'import.meta.env': {
        VITE_GROQ_API_KEY: JSON.stringify(env.VITE_GROQ_API_KEY),
        VITE_GROQ_API_URL: JSON.stringify(env.VITE_GROQ_API_URL),
        PROD: isProd,
        DEV: !isProd,
        MODE: JSON.stringify(mode)
      },
      global: 'globalThis',
    },
    optimizeDeps: {
      exclude: ['fs'],
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@mui/material',
        '@emotion/react',
        '@emotion/styled',
        'docx',
        'html-to-pdfmake',
        'pdfmake',
        'groq-sdk'
      ],
      esbuildOptions: {
        target: 'es2020',
        format: 'esm',
        mainFields: ['module', 'main'],
        conditions: ['module', 'import', 'default'],
        platform: 'browser'
      }
    },
    build: {
      target: 'es2020',
      rollupOptions: {
        external: ['fs'],
        output: {
          format: 'es',
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            mui: ['@mui/material', '@emotion/react', '@emotion/styled'],
            pdf: ['docx', 'html-to-pdfmake', 'pdfmake'],
            groq: ['groq-sdk']
          }
        }
      },
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
        defaultIsModuleExports: true,
        requireReturnsDefault: 'auto',
        extensions: ['.js', '.cjs']
      },
      outDir: 'dist',
      assetsDir: 'assets',
      assetsInlineLimit: 4096,
      dynamicImportVarsOptions: {
        warnOnError: true,
        exclude: [/node_modules/]
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        crypto: 'crypto-browserify'
      },
      mainFields: ['module', 'main'],
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
    },
    server: {
      port: 3000,
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
    }
  }
})
