import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// storage.persist() + 알림 스케줄러 시작은 데이터 레이어 도입 시 추가 — DESIGN.md §9 (Stage 3/6)
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
