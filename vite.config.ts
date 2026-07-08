import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// PWA(vite-plugin-pwa) 설정은 Stage 7에서 추가 — DESIGN.md §8, §10
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
