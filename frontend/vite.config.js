import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        exportType: 'named',
        ref: true,
        svgo: false,
        titleProp: true,
      },
      include: '**/*.svg',
    }),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicons/*.ico', 'favicons/*.png', 'help-screenshots/*.png'],
      manifest: {
        name: 'Divemap - Scuba Dive Site Review Platform',
        short_name: 'Divemap',
        description: 'Discover, rate and review dive sites and diving centers.',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        id: '/',
        icons: [
          {
            src: '/favicons/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/favicons/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        screenshots: [
          {
            src: "/help-screenshots/dive-sites-map-view.png",
            sizes: "2038x2388",
            type: "image/png",
            label: "Explore Dive Sites"
          },
          {
            src: "/help-screenshots/dives-logging-interface.png",
            sizes: "2036x2108",
            type: "image/png",
            label: "Log Your Dives"
          },
          {
            src: "/help-screenshots/dedicated-map-view.png",
            sizes: "2038x1053",
            type: "image/png",
            form_factor: "wide",
            label: "Map View"
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4MB to match the large vendor chunk
      }
    })
  ],
  server: {
    host: true, // Needed for Docker
    port: 3000, // Maintain existing port
    watch: {
      usePolling: true, // Needed for some Docker environments
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Put ALL node_modules into a single vendor chunk
            // This is the safest strategy to prevent circular dependencies and
            // initialization order issues (e.g. "Cannot read properties of undefined (reading 'forwardRef')")
            return 'vendor';
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  // Ensure .js files with JSX are handled (until renamed)
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
});
