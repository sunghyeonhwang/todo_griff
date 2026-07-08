import { useNow } from '../hooks/useNow';
import { formatMinutes, minutesToY } from '../lib/time';
import { useUiStore } from '../store/uiStore';

// 나우 인디케이터 — DESIGN.md §4.7
// - activeDateKey === 오늘일 때만 렌더 (todayKey는 useNow가 제공 — 자정 롤오버도 자동 반영).
// - 위치 = minutesToY(nowMin), 30초 틱 + visibilitychange 즉시 갱신(useNow).
// - 2px 라인(--now-indicator-width) + 좌측 8px 도트 + 거터 "HH:mm" 칩.
// - 색은 var(--surface-now-indicator) 토큰만(라이트/다크 자동). pointer-events: none, z-now(20).
// - 스크롤은 여기서 절대 하지 않는다 — 오토스크롤 규범은 Timeline 소관(§4.7).

export default function NowLine() {
  const activeDateKey = useUiStore((s) => s.activeDateKey);
  const { nowMin, todayKey } = useNow();

  if (activeDateKey !== todayKey) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-(--z-now)"
      style={{ top: minutesToY(nowMin) }}
    >
      {/* 라인: 거터 오른쪽 → 우측 끝, y 중앙 정렬 */}
      <div className="absolute right-0 left-(--time-label-width) h-(--now-indicator-width) -translate-y-1/2 rounded-full bg-surface-now-indicator" />
      {/* 좌측 8px 도트 — 라인 시작점에 센터 정렬 */}
      <div className="absolute left-(--time-label-width) size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface-now-indicator" />
      {/* 거터 시각 칩 — 시간 라벨 위를 덮음(z-now) */}
      <span className="absolute left-0 flex w-ruler -translate-y-1/2 justify-end pr-2">
        <span className="rounded-full bg-surface-now-indicator px-1.5 py-0.5 text-xs leading-none font-semibold tabular-nums text-text-on-solid">
          {formatMinutes(nowMin)}
        </span>
      </span>
    </div>
  );
}
