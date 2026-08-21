import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // O manifest é mantido à mão em public/ e já está linkado no index.html.
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Imagem servida pelo backend é imutável (a URL carrega o hash do
            // conteúdo do lado de lá), então cache primeiro e rede nunca.
            urlPattern: /\/api\/(img\?|game\/image\/)/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'media-images',
              expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Bibliotecas: rede primeiro para não mostrar dado velho com conexão,
            // com cache de resgate quando a rede não responde a tempo.
            urlPattern: /\/api\/[a-z-]*library(\/collections)?(\?.*)?$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'media-library',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Detalhe de drawer. O backend já responde do detail_cache quando a
            // API externa cai; isto cobre o caso de o backend também estar fora.
            urlPattern: /\/api\/(anime|movie|series|game|book)\/\d+(\/season\/\d+)?$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'media-detail',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
    },
  },
  // O service worker só existe no build, então testar o modo offline exige
  // `vite preview` — que precisa do mesmo proxy que o dev server.
  preview: {
    proxy: {
      '/api': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
