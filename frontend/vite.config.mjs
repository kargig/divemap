import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const gaId = env.VITE_GOOGLE_ANALYTICS_ID;

  const plugins = [
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
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt',
      devOptions: {
        enabled: false
      },
      includeAssets: ['favicons/*.ico', 'favicons/*.png', 'help-screenshots/*.png', 'robots.txt', 'offline.html'],
      manifest: {
        name: 'Divemap - Scuba Dive Site Review Platform',
        short_name: 'Divemap',
        description: 'Discover, rate and review dive sites and diving centers.',
        theme_color: '#0072B2',
        background_color: '#ffffff',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        orientation: 'any',
        dir: 'ltr',
        prefer_related_applications: false,
        related_applications: [],
        scope: '/',
        start_url: '/?utm_source=pwa',
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
            src: "/help-screenshots/dive-sites-map-view.webp",
            sizes: "1092x1280",
            type: "image/webp",
            form_factor: "narrow",
            label: "Explore Dive Sites"
          },
          {
            src: "/help-screenshots/dives-logging-interface.webp",
            sizes: "1236x1280",
            type: "image/webp",
            form_factor: "narrow",
            label: "Log Your Dives"
          },
          {
            src: "/help-screenshots/dedicated-map-view.webp",
            sizes: "1280x661",
            type: "image/webp",
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
      injectManifest: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      }
    })
  ];

  if (mode === 'production' && gaId) {
    plugins.push({
      name: 'google-analytics',
      transformIndexHtml(html) {
        return html.replace(
          '<head>',
          `<head>
    <!-- Google tag (gtag.js) with Google Consent Mode v2 -->
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      var savedConsent = null;
      try {
        savedConsent = JSON.parse(localStorage.getItem('divemap_cookie_consent'));
      } catch (e) {}
      var analyticsGranted = savedConsent && savedConsent.analytics === true;
      gtag('consent', 'default', {
        'analytics_storage': analyticsGranted ? 'granted' : 'denied',
        'ad_storage': 'denied',
        'ad_user_data': 'denied',
        'ad_personalization': 'denied'
      });
      gtag('js', new Date());
      gtag('config', '${gaId}');

      function initGTM() {
        if (window._gtmLoaded) return;
        window._gtmLoaded = true;
        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=${gaId}';
        document.head.appendChild(s);
      }
      if ('requestIdleCallback' in window) {
        requestIdleCallback(initGTM, { timeout: 2500 });
      } else {
        window.addEventListener('load', function() {
          setTimeout(initGTM, 1000);
        });
      }
    </script>`
        );
      }
    });
  }

  return {
    plugins,
    server: {
      host: true, // Needed for Docker
      port: 3000, // Maintain existing port
      allowedHosts: ['dev.divemap.gr', 'dev.divemap.blue', 'localhost'], // Fix DNS rebinding block
      hmr: {
        clientPort: 80,
        path: '/@vite/hmr',
      },
      watch: {
        usePolling: true, // Needed for some Docker environments
      },
    },
    optimizeDeps: {
      entries: ['src/**/*.{js,jsx}', 'index.html'],
      include: [
        'canvas-confetti',
        'yet-another-react-lightbox',
        'yet-another-react-lightbox/plugins/captions',
        'yet-another-react-lightbox/plugins/counter',
        'yet-another-react-lightbox/plugins/download',
        'yet-another-react-lightbox/plugins/fullscreen',
        'yet-another-react-lightbox/plugins/inline',
        'yet-another-react-lightbox/plugins/slideshow',
        'yet-another-react-lightbox/plugins/thumbnails',
        '@hookform/resolvers/zod',
        'lodash/debounce',
        'lodash/escape',
        'react-dom/client',
        'react-dom/server',
        'react-image-crop',
        'react-simplemde-editor',
        'easymde',
        'html2canvas',
        'jspdf',
        'recharts',
        'leaflet',
        'leaflet-draw',
        'leaflet.markercluster',
        'react-leaflet',
        '@tanstack/react-table',
        '@dnd-kit/core',
        '@dnd-kit/sortable',
        '@dnd-kit/utilities',
        '@emoji-mart/react',
        'react-slider',
        'react-textarea-autosize',
        'fuse.js',
        'dompurify',
      ],
    },
  build: {
    outDir: 'dist',
    // Increase chunk size limit slightly to avoid unnecessary warnings
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'assets-vendor',
              test: /[\/]node_modules[\/](lucide-react|@ant-design\/icons|lodash|date-fns)[\/]/,
            },
          ],
        },
      },
    },
  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(import.meta.dirname, './src') },
      { find: /^@ant-design\/icons$/, replacement: '@ant-design/icons/es' },
    ],
    dedupe: ['react', 'react-dom'],
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    pool: 'vmThreads',
    server: {
      deps: {
        inline: true,
      },
    },
  },
  };
});
