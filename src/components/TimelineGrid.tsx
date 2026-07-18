import { Fragment, memo } from 'react';
import { MINOR_GRID, formatMinutes, minutesToY } from '../lib/time';

// 정적 시간 눈금 — DESIGN.md §4.1 (개정: 10분 보조 헤어라인 도입)
// - 시간선 라벨 25개(00:00–24:00), 전부 formatMinutes(h*60)으로 생성.
// - 10분 보조 헤어라인(§4.1 개정): 10분 스냅과 시각 정합을 위해 시간선 사이 10/20/30/40/50분에
//   옅은 눈금을 넣는다(기존 "부 눈금 없음" 규칙을 개정). 색은 시간선과 같은 --surface-timeline-line을
//   opacity로 옅게 파생 — 별도 토큰 없이 계층만 구분. 라벨은 시간선에만.
// - 라벨: var(--surface-timeline-label), --fs-xs(11px) tabular-nums,
//   그리드라인에 수직 중앙 정렬(translateY(-50%)), 거터(--time-label-width) 우측 정렬.
// - 헤어라인: var(--surface-timeline-line), 거터 오른쪽부터 우측 끝까지 1px.
// - 전체 pointer-events: none(§4.5) + aria-hidden(장식). props 없음 → React.memo로 1회 렌더.

const HOURS = Array.from({ length: 24 + 1 }, (_, h) => h); // 00:00–24:00 = 25개

// 10분 보조 눈금 분값 — 매 시각의 10/20/30/40/50분(시간선과 자정·24:00은 제외)
const MINOR_MINUTES = Array.from({ length: 24 }, (_, h) => h * 60).flatMap((base) =>
  Array.from({ length: 60 / MINOR_GRID - 1 }, (_, i) => base + (i + 1) * MINOR_GRID),
);

const TimelineGrid = memo(function TimelineGrid() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {/* 10분 보조 헤어라인(시간선보다 옅게, §4.1 개정) */}
      {MINOR_MINUTES.map((min) => (
        <div
          key={`m${min}`}
          className="absolute right-0 left-(--time-label-width) h-px bg-surface-timeline-line opacity-40"
          style={{ top: minutesToY(min) }}
        />
      ))}
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
