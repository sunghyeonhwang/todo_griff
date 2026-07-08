import { Fragment, memo } from 'react';
import { formatMinutes, minutesToY } from '../lib/time';

// 정적 시간 눈금 — DESIGN.md §4.1
// - 라벨 25개(00:00–24:00), 전부 formatMinutes(h*60)으로 생성. 부(副) 눈금 없음.
// - 라벨: var(--surface-timeline-label), --fs-xs(11px) tabular-nums,
//   그리드라인에 수직 중앙 정렬(translateY(-50%)), 거터(--time-label-width) 우측 정렬.
// - 헤어라인: var(--surface-timeline-line), 거터 오른쪽부터 우측 끝까지 1px.
// - 전체 pointer-events: none(§4.5) + aria-hidden(장식). props 없음 → React.memo로 1회 렌더.

const HOURS = Array.from({ length: 24 + 1 }, (_, h) => h); // 00:00–24:00 = 25개

const TimelineGrid = memo(function TimelineGrid() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {HOURS.map((h) => {
        const y = minutesToY(h * 60);
        return (
          <Fragment key={h}>
            <div
              className="absolute right-0 left-(--time-label-width) h-px bg-surface-timeline-line"
              style={{ top: y }}
            />
            <span
              className="absolute left-0 w-ruler -translate-y-1/2 pr-2 text-right text-xs tabular-nums text-surface-timeline-label"
              style={{ top: y }}
            >
              {formatMinutes(h * 60)}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
});

export default TimelineGrid;
