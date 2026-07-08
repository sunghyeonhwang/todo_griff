import { useEffect, useState } from 'react';
import { nowMinutes, toDateKey } from '../lib/time';

// 현재 시각 훅 — DESIGN.md §4.7, §9
// 30초 인터벌 + visibilitychange → visible 시 즉시 갱신(백그라운드 탭 타이머 스로틀 보정).
// 값이 실제로 바뀔 때만 setState(참조 유지) — 분이 안 바뀐 틱은 리렌더 없음.
// 이 훅은 시각만 제공한다 — 자동 스크롤은 절대 하지 않는다(§4.7: 사용자 스크롤 위치 불가침).

const TICK_MS = 30_000; // §4.7 30초 인터벌 (알림 스케줄러 §7과 동일 주기)

export interface NowInfo {
  nowMin: number;   // 자정 기준 현재 분 — nowMinutes() 네이티브 산술
  todayKey: string; // 오늘 dateKey — 자정 롤오버·나우라인 렌더 게이트용
}

function readNow(): NowInfo {
  return { nowMin: nowMinutes(), todayKey: toDateKey(new Date()) };
}

export function useNow(): NowInfo {
  const [now, setNow] = useState<NowInfo>(readNow);

  useEffect(() => {
    const tick = () => {
      setNow((prev) => {
        const next = readNow();
        return prev.nowMin === next.nowMin && prev.todayKey === next.todayKey
          ? prev
          : next;
      });
    };
    const id = window.setInterval(tick, TICK_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return now;
}
