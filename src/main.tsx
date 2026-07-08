import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { startAlarmScheduler } from './lib/alarms';

// 지원 브라우저에서 스토리지 축출 방지 — DESIGN.md §3.1 (거부/미지원이어도 무해, fire-and-forget)
if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}

// 알림 스케줄러 — DESIGN.md §7, §9: persist hydration 완료 후 시작(내부에서 보장)
startAlarmScheduler();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
