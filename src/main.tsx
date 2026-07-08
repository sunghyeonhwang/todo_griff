import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// 지원 브라우저에서 스토리지 축출 방지 — DESIGN.md §3.1 (거부/미지원이어도 무해, fire-and-forget)
if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}

// 알림 스케줄러 시작(hydration 후)은 Stage 6 — DESIGN.md §7, §9
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
