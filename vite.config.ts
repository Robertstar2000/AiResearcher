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
      react({
        babel: {
          plugins: [],
          parserOpts: {
            plugins: ['jsx']
          }
        }
      }),
      nodePolyfills({
        include: ['path', 'crypto', 'stream', 'util', 'buffer', 'process'],
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
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@mui/material',
        '@mui/system',
        '@mui/icons-material',
        'docx',
        'html-to-pdfmake',
        'pdfmake',
        'groq-sdk'
      ],
      exclude: ['sql.js'],
      esbuildOptions: {
        target: 'es2020',
        platform: 'browser',
        supported: {
          'top-level-await': true
        }
      }
    },
    build: {
      target: 'es2020',
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: !isProd,
      minify: isProd ? 'terser' : false,
      terserOptions: {
        compress: {
          drop_console: isProd,
          drop_debugger: isProd
        }
      },
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            mui: ['@mui/material', '@mui/system', '@mui/icons-material'],
            pdf: ['docx', 'html-to-pdfmake', 'pdfmake'],
            groq: ['groq-sdk']
          }
        }
      },
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        crypto: 'crypto-browserify',
        stream: 'stream-browserify',
        buffer: 'buffer'
      },
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
    },
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      },
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
      }
    },
    publicDir: 'public',
    assetsInclude: ['**/*.wasm']
  }
});
