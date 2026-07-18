import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { startAlarmScheduler } from './lib/alarms';
import { startQueSync } from './store/queSync';
import { startPersonalSync } from './store/personalSync';

// 지원 브라우저에서 스토리지 축출 방지 — DESIGN.md §3.1 (거부/미지원이어도 무해, fire-and-forget)
if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}

// 알림 스케줄러 — DESIGN.md §7, §9: persist hydration 완료 후 시작(내부에서 보장)
startAlarmScheduler();

// Que 동기화 — DESIGN.md §14: 라이트백 구독 즉시 + 하이드레이션 후 초기 풀/플러시(내부 보장). 멱등.
startQueSync();

// 개인 블록·See 스냅샷 동기화 — DESIGN.md §14.10: 순수 개인 블록(queTaskId 없음)+리뷰를 서버 미러링. 멱등.
startPersonalSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
