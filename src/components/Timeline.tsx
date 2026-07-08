import { useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef, type Ref } from 'react';
import NowLine from './NowLine';
import TimeBlockCard from './TimeBlockCard';
import TimelineGrid from './TimelineGrid';
import {
  BOTTOM_PAD,
  DAY_HEIGHT,
  SCROLL_ANCHOR,
  TOP_PAD,
  isTodayKey,
  minutesToY,
  nowMinutes,
} from '../lib/time';
import { useBlocksStore } from '../store/blocksStore';
import { useUiStore } from '../store/uiStore';

// 타임라인 — DESIGN.md §4.1, §4.7, §6.5
// - 스크롤 컨테이너 소유: flex-1 min-h-0 overflow-y-auto, touch-action pan-y,
//   overscroll-behavior-y contain(풀투리프레시 차단). 휴지 상태 non-passive 리스너 0개(§4.5).
// - 캔버스: DAY_HEIGHT(2304px) relative — 00:00 원점. TOP_PAD/BOTTOM_PAD(+하단 safe-area)는
//   스크롤러 패딩 → clientYToContentY의 TOP_PAD 보정과 일치(§4.1).
// - 오토스크롤 규칙(§4.7 단일 규범): 최초 마운트(오늘) = instant / "오늘" 버튼 = smooth
//   (App이 TimelineHandle.scrollToNow로 배선, 이미 오늘이어도 실행) / 그 외 절대 자동 스크롤 없음
//   — 날짜 전환(‹ ›)·나우 틱·visibilitychange에도 사용자 스크롤 위치 불가침.
// - 캔버스에 활성 날짜 블록 카드 렌더(Stage 3, 풀폭 — lane 분할은 Stage 6).
//   Stage 5: DndContext 장착(캔버스 내부 마운트).

export interface TimelineHandle {
  /** 나우라인을 뷰포트 상단 SCROLL_ANCHOR(30%) 지점으로 스크롤(§4.7) */
  scrollToNow(behavior: ScrollBehavior): void;
}

export default function Timeline({ ref }: { ref?: Ref<TimelineHandle> }) {
  const scrollerRef = useRef<HTMLElement>(null);

  // 활성 날짜의 블록 id 목록 — §3.3: 셀렉터에서 filter 금지(매번 새 배열 → 리렌더 폭풍).
  // 안정된 blocks 맵을 선택한 뒤 useMemo로 파생. 정렬은 startMin 오름차순, 동률 시 긴 블록 우선(§4.6).
  const activeDateKey = useUiStore((s) => s.activeDateKey);
  const blocks = useBlocksStore((s) => s.blocks);
  const dayBlockIds = useMemo(
    () =>
      Object.values(blocks)
        .filter((b) => b.dateKey === activeDateKey)
        .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin || a.id.localeCompare(b.id))
        .map((b) => b.id),
    [blocks, activeDateKey],
  );

  const scrollToNow = useCallback((behavior: ScrollBehavior) => {
    const el = scrollerRef.current;
    if (!el) return;
    // 목표: 나우라인 y(캔버스 원점 + TOP_PAD)가 뷰포트 상단 30% 지점에 오도록.
    // scrollTo가 [0, scrollHeight-clientHeight]로 자체 클램프(자정 근처 안전).
    const top = TOP_PAD + minutesToY(nowMinutes()) - el.clientHeight * SCROLL_ANCHOR;
    el.scrollTo({ top, behavior });
  }, []);

  useImperativeHandle(ref, () => ({ scrollToNow }), [scrollToNow]);

  // 최초 마운트가 오늘이면 instant 스크롤-투-나우 — 페인트 전(useLayoutEffect) 1회만.
  const didInitialScroll = useRef(false);
  useLayoutEffect(() => {
    if (didInitialScroll.current) return;
    didInitialScroll.current = true;
    if (isTodayKey(useUiStore.getState().activeDateKey)) scrollToNow('instant');
  }, [scrollToNow]);

  return (
    <main
      ref={scrollerRef}
      className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain"
      style={{
        paddingTop: TOP_PAD,
        paddingBottom: `calc(${BOTTOM_PAD}px + env(safe-area-inset-bottom))`,
      }}
    >
      <div className="relative" style={{ height: DAY_HEIGHT }}>
        <TimelineGrid />
        {dayBlockIds.map((id) => (
          <TimeBlockCard key={id} id={id} />
        ))}
        <NowLine />
      </div>
    </main>
  );
}
