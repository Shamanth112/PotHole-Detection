import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'logo.png', 'robots.txt', 'best.onnx'],
        // Pre-cache the app shell + the YOLOv8 model so the AI scanner
        // works on first load even with poor connectivity (this is a
        // field-use app — road crews have bad signal).
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,wasm,mjs,onnx}'],
          // The YOLO model is ~16-30 MB — bump the default limit so
          // Workbox actually caches it instead of warning.
          maximumFileSizeToCacheInBytes: 60 * 1024 * 1024,
          runtimeCaching: [
            {
              // Convex API calls — NetworkFirst so we get fresh data
              // when online, fall back to cache when offline.
              urlPattern: /convexcloud\.com|convex\.dev/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'convex-api',
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              // Google Maps tiles — CacheFirst (they're immutable per version)
              urlPattern: /googleapis\.com\/.*\/maps/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-maps-tiles',
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // YOLOv8 model — CacheFirst so it's only fetched once
              urlPattern: /best\.onnx|models\/.*\.onnx/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'ml-models',
                expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 90 },
              },
            },
          ],
        },
        manifest: {
          name: 'RoadGuard — AI Pothole Reporter',
          short_name: 'RoadGuard',
          description: 'AI-powered pothole detection and civic reporting.',
          theme_color: '#0b1220',
          background_color: '#0b1220',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/logo.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
      }),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(process.env.GOOGLE_MAPS_PLATFORM_KEY || '')
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      headers: {
        // Required for SharedArrayBuffer — needed by onnxruntime-web WASM backend
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
      },
    },
  };
});