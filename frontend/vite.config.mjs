import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

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
    visualizer({
      open: false,
      filename: 'bundle-stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
    VitePWA({
      registerType: 'prompt',
      devOptions: {
        enabled: false
      },
      includeAssets: ['favicons/*.ico', 'favicons/*.png', 'help-screenshots/*.png', 'robots.txt', 'offline.html'],
      manifest: {
        name: 'Divemap - Scuba Dive Site Review Platform',
        short_name: 'Divemap',
        description: 'Discover, rate and review dive sites and diving centers.',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        orientation: 'any',
        dir: 'ltr',
        prefer_related_applications: false,
        related_applications: [],
        scope: '/',
        start_url: '/',
        id: '/',
        categories: ['travel', 'sports', 'social'],
        launch_handler: {
          client_mode: ["navigate-existing", "auto"]
        },
        share_target: {
          action: "/dive-sites",
          method: "GET",
          enctype: "application/x-www-form-urlencoded",
          params: {
            title: "title",
            text: "text",
            url: "url"
          }
        },
        protocol_handlers: [
          {
            protocol: "web+divemap",
            url: "/dive-sites?q=%s"
          }
        ],
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
            form_factor: "narrow",
            label: "Explore Dive Sites"
          },
          {
            src: "/help-screenshots/dives-logging-interface.png",
            sizes: "2036x2108",
            type: "image/png",
            form_factor: "narrow",
            label: "Log Your Dives"
          },
          {
            src: "/help-screenshots/dedicated-map-view.png",
            sizes: "2038x1053",
            type: "image/png",
            form_factor: "wide",
            label: "Map View"
          }
        ],
        shortcuts: [
          {
            name: "Explore Map",
            short_name: "Map",
            description: "View the map of dive sites",
            url: "/map",
            icons: [{ src: "/favicons/android-chrome-192x192.png", sizes: "192x192" }]
          },
          {
            name: "Log Dive",
            short_name: "Log Dive",
            description: "Log a new dive",
            url: "/dives/create",
            icons: [{ src: "/favicons/android-chrome-192x192.png", sizes: "192x192" }]
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // Reduced from 4MB to 3MB as chunks are now split
        // Exclude non-SPA routes from navigation fallback
        navigateFallbackDenylist: [
          /^\/robots\.txt$/,
          /^\/sitemap\.xml$/,
          /^\/llms\.txt$/,
          /^\/.*\.md$/,
          /^\/l\/.*$/,
          /^\/api\/.*$/,
          /^\/docs\/?.*$/,
          /^\/redoc\/?.*$/,
          /^\/openapi\.json$/,
          /^\/health$/,
          /^\/nginx-health$/
        ],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/v1\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              networkTimeoutSeconds: 10 // Fallback to cache if network takes > 10s
            }
          },
          {
            urlPattern: /^https:\/\/.*\.openstreetmap\.org\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 Days
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets'
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
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
    // Increase chunk size limit slightly to avoid unnecessary warnings
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Group small icon and utility files into a single stable chunk
        // to reduce the number of network requests (the "micro-chunk" problem).
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Group all icons and small common utilities together
            if (
              id.includes('lucide-react') || 
              id.includes('@ant-design/icons') || 
              id.includes('lodash') ||
              id.includes('date-fns')
            ) {
              return 'assets-vendor';
            }
          }
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
});
