import { useEffect, useState } from 'react';
import { useUiStore } from '../store/uiStore';

// 인앱 알림 배너 — DESIGN.md §9 (자동 소멸, z-toast)
// - 소스는 uiStore.toast 하나: 알림 발화(§7)·스토리지 경고(§3.1) 공용.
// - seq가 바뀔 때마다 다시 표시 + 소멸 타이머 리셋 — 같은 메시지 연속 발화도 갱신됨.
// - 자동 소멸은 로컬 상태로만(스토어 무변경) — 표시 여부는 렌더 관심사(§3.2).
// - fixed 뷰포트 하단 중앙(max-w-app 컬럼과 정렬) + safe-area, z-toast(60) — 시트(50) 위.
// - pointer-events: none — 타임라인·시트 조작을 가로채지 않는 순수 배너.

const TOAST_DURATION_MS = 4000; // 자동 소멸 대기(§9 미규정 — 4초 채택)

export default function Toast() {
  const toast = useUiStore((s) => s.toast);
  const [visibleSeq, setVisibleSeq] = useState<number | null>(null);

  useEffect(() => {
    if (!toast) return;
    setVisibleSeq(toast.seq);
    const id = window.setTimeout(
      () => setVisibleSeq((cur) => (cur === toast.seq ? null : cur)),
      TOAST_DURATION_MS,
    );
    return () => window.clearTimeout(id);
  }, [toast]);

  if (!toast || visibleSeq !== toast.seq) return null;

  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-(--z-toast) flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
    >
      <div className="max-w-app rounded-lg bg-surface-card-elevated px-4 py-3 text-sm text-text-primary shadow-lg">
        {toast.message}
      </div>
    </div>
  );
}
