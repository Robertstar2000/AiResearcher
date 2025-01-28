// Vite Configuration File
// This file configures the Vite build system and development server for the AI Researcher application

// Import required Vite plugins and configuration types
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

// Define the Vite configuration
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProd = mode === 'production'

  console.log('Vite Environment Variables:')
  console.log('Environment:', mode)
  console.log('VITE_GROQ_API_KEY:', env.VITE_GROQ_API_KEY ? 'exists' : 'missing')
  console.log('VITE_GROQ_API_URL:', env.VITE_GROQ_API_URL ? 'exists' : 'missing')

  return {
    // Base configuration for production and development
    base: './',  // Sets the base public path for all assets. './' makes it relative to index.html

    // Build configuration options
    build: {
      // Ensures compatibility with older browsers and systems
      target: 'es2020',  // Target modern browsers with ES module support
      
      // Configure output directory and asset handling
      outDir: 'dist',    // Output directory for production build
      assetsDir: 'assets', // Directory for static assets within outDir
      
      // Optimization settings
      minify: isProd ? 'terser' : false,  // Use terser for minification in production
      sourcemap: !isProd,    // Generate sourcemaps for debugging in development
      
      // Chunk splitting strategy
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

    // Development server configuration
    server: {
      // Network and port settings
      port: 3000,         // Default development server port
      host: true,         // Allow access from all network interfaces
      
      // CORS and security settings
      cors: true,         // Enable CORS for development
      
      // Hot Module Replacement (HMR) settings
      hmr: {
        overlay: true,    // Show errors as overlay in browser
      },
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

    // Plugin configuration
    plugins: [
      // React plugin for Vite
      // Enables React component hot reloading and JSX compilation
      react({
        babel: {
          plugins: [],
          parserOpts: {
            plugins: ['jsx']
          }
        }
      }),
      // Node polyfills plugin
      nodePolyfills({
        include: ['path', 'crypto', 'stream', 'util', 'buffer', 'process'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],

    // Dependency optimization settings
    optimizeDeps: {
      // Include specific dependencies for pre-bundling
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
      // Force inclusion in optimization step
      force: true, // Ensure dependencies are optimized even if already processed
      esbuildOptions: {
        target: 'es2020',
        platform: 'browser',
        supported: {
          'top-level-await': true
        }
      }
    },

    // Resolution configuration for modules and assets
    resolve: {
      // Configure module aliases for cleaner imports
      alias: {
        '@': path.resolve(__dirname, './src'),
        crypto: 'crypto-browserify',
        stream: 'stream-browserify',
        buffer: 'buffer'
      },
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
    },

    // Environment variables configuration
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
    envPrefix: 'VITE_', // Only expose env variables prefixed with VITE_
  }
});
