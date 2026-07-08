import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { STRINGS } from './strings';
import { useUiStore } from '../store/uiStore';

// 손상 대응 영속 스토리지 — DESIGN.md §3.1, §13.1
// zustand PersistStorage 구현: 데이터를 조용히 파괴하지 않는다.
// - JSON 파싱 실패 → 원본을 `<key>.corrupt.<ts>`로 백업 후 빈 상태 부팅 + 토스트 안내.
// - QuotaExceeded(등 쓰기 실패) → 쓰기 스킵 + 토스트. 메모리 상태는 유지된다.
// §13: 서버 연동 시 같은 인터페이스의 어댑터 교체·합성 지점(원격 저장/하이브리드 캐시).
// 컴포넌트/훅의 localStorage 직접 접근 금지 — 이 모듈이 유일한 통과점이다.

function toast(message: string): void {
  // Toast 컴포넌트 렌더는 Stage 6 — 상태는 지금부터 정확히 기록된다(§3.2 showToast).
  useUiStore.getState().showToast(message);
}

export function createSafeStorage<S>(): PersistStorage<S> {
  return {
    getItem: (name) => {
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(name);
      } catch {
        return null; // 스토리지 접근 자체 불가(프라이버시 모드 등) — 빈 상태 부팅
      }
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as StorageValue<S>;
      } catch {
        try {
          localStorage.setItem(`${name}.corrupt.${Date.now()}`, raw);
        } catch {
          // 백업조차 실패해도 원본 키는 다음 저장 전까지 남아 있다
        }
        toast(STRINGS.storage.corruptBackup);
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        localStorage.setItem(name, JSON.stringify(value));
      } catch {
        toast(STRINGS.storage.quotaExceeded);
      }
    },
    removeItem: (name) => {
      try {
        localStorage.removeItem(name);
      } catch {
        // 제거 실패는 치명적이지 않음 — 무시
      }
    },
  };
}
