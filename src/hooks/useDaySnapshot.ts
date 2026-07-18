import { useEffect } from 'react';
import { useNow } from './useNow';
import { useBlocksStore } from '../store/blocksStore';
import { useReviewStore, type PlanItem } from '../store/reviewStore';

// 하루 계획 스냅샷 캡처 훅 — DESIGN.md §16 (Plan-Do-See의 See)
//
// 그날 첫 조회 시점(persist 하이드레이션 후 + dateKey 전환 감지)에 오늘 블록들의 계획을 저장한다.
// - 트리거: 마운트(하이드레이션 후) + 자정 롤오버로 todayKey가 바뀔 때(useNow가 감지).
// - 캡처는 reviewStore.captureSnapshot 1곳으로만(§16 규율) — 이미 있으면 no-op(불변).
// - blocksStore·reviewStore 둘 다 하이드레이션 완료를 보장한 뒤 캡처한다(하이드레이션 전 캡처가
//   직후의 merge로 덮여 사라지는 것 방지). 두 스토어 모두 이미 완료면 즉시 실행.

/** 두 persist 스토어의 하이드레이션 완료 후 cb 1회 실행. 정리 함수 반환. */
function whenHydrated(cb: () => void): () => void {
  const b = useBlocksStore.persist;
  const r = useReviewStore.persist;
  let bDone = b.hasHydrated();
  let rDone = r.hasHydrated();
  let ran = false;
  const run = () => {
    if (ran || !bDone || !rDone) return;
    ran = true;
    cb();
  };
  const unsubB = bDone ? undefined : b.onFinishHydration(() => { bDone = true; run(); });
  const unsubR = rDone ? undefined : r.onFinishHydration(() => { rDone = true; run(); });
  run();
  return () => { unsubB?.(); unsubR?.(); };
}

export function useDaySnapshot(): void {
  const { todayKey } = useNow();

  useEffect(() => {
    return whenHydrated(() => {
      const blocks = useBlocksStore.getState().blocks;
      const items: PlanItem[] = Object.values(blocks)
        .filter((b) => b.dateKey === todayKey)
        .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
        .map((b) => ({ id: b.id, title: b.title, startMin: b.startMin, endMin: b.endMin }));
      useReviewStore.getState().captureSnapshot(todayKey, items);
    });
  }, [todayKey]);
}
