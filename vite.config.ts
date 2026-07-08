import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { STRINGS } from './src/lib/strings';

// PWA 설정 — DESIGN.md §8. theme/background #F7F8FA = --surface-background(라이트) 토큰 값.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: STRINGS.appName,
        short_name: STRINGS.appName,
        description: STRINGS.appDescription,
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'ko',
        theme_color: '#F7F8FA',
        background_color: '#F7F8FA',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // woff2 포함 — Freesentation 로컬 폰트(≈1MB)를 프리캐시해 오프라인에서도 서체 유지(§6.4)
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
      },
      devOptions: { enabled: false }, // 수동 SW 테스트 때만 true (§8)
    }),
  ],
});
