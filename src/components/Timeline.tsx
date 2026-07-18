import { useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react';
import { DndContext, useSensor, useSensors } from '@dnd-kit/core';
import type { AutoScrollOptions, DragEndEvent, DragStartEvent, Modifiers } from '@dnd-kit/core';
import { createSnapModifier, restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import DragCreateGhost from './DragCreateGhost';
import NowLine from './NowLine';
import TimeBlockCard from './TimeBlockCard';
import TimelineGrid from './TimelineGrid';
import { useDragCreate } from '../hooks/useDragCreate';
import {
  MOVE_MOUSE_DISTANCE_PX,
  MOVE_TOUCH_DELAY_MS,
  MOVE_TOUCH_TOLERANCE_PX,
  MouseSensor,
  TouchSensor,
} from '../lib/dndSensors';
import { computeLanes } from '../lib/lanes';
import { STRINGS } from '../lib/strings';
import {
  BOTTOM_PAD,
  DAY_HEIGHT,
  DAY_MINUTES,
  EMPTY_HINT_END_MIN,
  EMPTY_HINT_START_MIN,
  GESTURE_SNAP,
  PX_PER_MIN,
  RULER_WIDTH,
  SCROLL_ANCHOR,
  TOP_PAD,
  clamp,
  isTodayKey,
  minutesToY,
  nowMinutes,
  snapMin,
  yToMinutes,
} from '../lib/time';
import { useBlocksStore } from '../store/blocksStore';
import { useUiStore } from '../store/uiStore';

// 타임라인 — DESIGN.md §4.1, §4.3, §4.7, §6.5
// - 스크롤 컨테이너 소유: flex-1 min-h-0 overflow-y-auto, touch-action pan-y,
//   overscroll-behavior-y contain(풀투리프레시 차단). 휴지 상태 non-passive 리스너 0개(§4.5).
// - 캔버스: DAY_HEIGHT(2304px) relative — 00:00 원점. TOP_PAD/BOTTOM_PAD(+하단 safe-area)는
//   스크롤러 패딩 → clientYToContentY의 TOP_PAD 보정과 일치(§4.1).
// - 오토스크롤 규칙(§4.7 단일 규범): 최초 마운트(오늘) = instant / "오늘" 버튼 = smooth
//   (App이 TimelineHandle.scrollToNow로 배선, 이미 오늘이어도 실행) / 그 외 절대 자동 스크롤 없음
//   — 날짜 전환(‹ ›)·나우 틱·visibilitychange에도 사용자 스크롤 위치 불가침.
// - 블록 이동(Stage 5, §4.3): DndContext 캔버스 내부 마운트 — 카드의 DOM 부모가 캔버스라
//   restrictToParentElement가 일 경계의 시각 제한이 된다. 드롭 타깃/충돌 감지 미사용,
//   위치는 delta.y의 순수 함수. 커밋은 onDragEnd의 moveBlock 1회(§3.2).
// - 드래그 생성(Stage 4, §4.2): useDragCreate 핸들러는 캔버스(빈 면)에만 스프레드 —
//   블록 카드가 pointerdown을 stopPropagation 하므로 기존 블록 위에서는 시작 불가.
//   빈 면 touch-action: pan-y(§4.5 표) — 생성은 400ms 롱프레스로만 무장.
//   + select-none / touch-callout 차단 / contextmenu preventDefault(§4.5 하드닝).
// - 겹침 lane(Stage 6, §4.6): computeLanes를 useMemo로 파생, 드래그 중 블록은
//   excludeId로 제외(카드가 풀폭 90%로 위에 렌더). 빈 날 힌트(§6.5)는 드래프트 중 숨김.

// 이동 모디파이어(§4.3) — 시각 보조일 뿐, 최종 권위는 onDragEnd 클램프 수식.
// 세로 고정 → 10분 그리드(= 16px, §4.1 개정 정수) 스냅 → 캔버스(부모) 경계 제한.
const MOVE_MODIFIERS: Modifiers = [
  restrictToVerticalAxis,
  createSnapModifier(GESTURE_SNAP * PX_PER_MIN),
  restrictToParentElement,
];

// dnd-kit 내장 autoScroll(§4.3) — 세로 전용(x 임계 0), 뷰포트 높이 15% 엣지 존, 가속 10
const MOVE_AUTOSCROLL_THRESHOLD_Y = 0.15;
const MOVE_AUTOSCROLL_ACCELERATION = 10;
const MOVE_AUTOSCROLL: AutoScrollOptions = {
  threshold: { x: 0, y: MOVE_AUTOSCROLL_THRESHOLD_Y },
  acceleration: MOVE_AUTOSCROLL_ACCELERATION,
};

export interface TimelineHandle {
  /** 나우라인을 뷰포트 상단 SCROLL_ANCHOR(30%) 지점으로 스크롤(§4.7) */
  scrollToNow(behavior: ScrollBehavior): void;
}

export default function Timeline({ ref }: { ref?: Ref<TimelineHandle> }) {
  const scrollerRef = useRef<HTMLElement>(null);
  const { draft, surfaceHandlers } = useDragCreate(scrollerRef);

  // 활성 날짜의 블록 목록 — §3.3: 셀렉터에서 filter 금지(매번 새 배열 → 리렌더 폭풍).
  // 안정된 blocks 맵을 선택한 뒤 useMemo로 파생. 정렬은 startMin 오름차순, 동률 시 긴 블록 우선(§4.6).
  const activeDateKey = useUiStore((s) => s.activeDateKey);
  const blocks = useBlocksStore((s) => s.blocks);
  const dayBlocks = useMemo(
    () =>
      Object.values(blocks)
        .filter((b) => b.dateKey === activeDateKey)
        .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin || a.id.localeCompare(b.id)),
    [blocks, activeDateKey],
  );

  // 겹침 lane 배치(§4.6) — 이동 드래그 중 블록은 excludeId로 제외(풀폭 90% 위 렌더,
  // 이웃 리플로 방지), 드롭·취소 시 1회 재계산. 컴포넌트 레벨 useMemo — 스토어에 두지 않음.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const lanes = useMemo(() => computeLanes(dayBlocks, draggingId), [dayBlocks, draggingId]);

  // 빈 날 힌트(§6.5) — 생성 드래프트(훅 프리뷰 또는 이 날짜의 create 에디터) 활성 중엔 숨김.
  // 불리언 셀렉터 — 에디터 내용 변경으로 타임라인이 리렌더되지 않는다(§3.3).
  const createDraftActive = useUiStore(
    (s) => s.editor.mode === 'create' && s.editor.draft.dateKey === s.activeDateKey,
  );
  const showEmptyHint = dayBlocks.length === 0 && draft === null && !createDraftActive;

  // 이동 센서(§4.3) — data-no-dnd 인식 서브클래스(lib/dndSensors):
  // 마우스 4px 미만 = 클릭, 터치 300ms 홀드 전 8px 초과 스와이프 = 스크롤(§4.5 매트릭스)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: MOVE_MOUSE_DISTANCE_PX } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: MOVE_TOUCH_DELAY_MS, tolerance: MOVE_TOUCH_TOLERANCE_PX },
    }),
  );

  // 터치 300ms 롱프레스 = 선택 겸용(§4.4) — 이동 없이 떼도 선택 유지 → 핸들 노출(§4.10-9).
  // 마우스는 hover가 핸들을 노출하므로 선택하지 않는다. getState 경유 — 구독·리렌더 없음.
  // draggingId는 lane 계산의 excludeId(§4.6) — 시작 시 세팅, 드롭·취소 시 해제.
  const handleDragStart = useCallback((e: DragStartEvent) => {
    setDraggingId(String(e.active.id));
    if (e.activatorEvent.type === 'touchstart') {
      useUiStore.getState().select(String(e.active.id));
    }
  }, []);

  // 최종 권위 클램프 수식(§4.3): newStart = clamp(start + snapMin(Δy/PX_PER_MIN, 10), 0, 1440-길이).
  // e.delta는 모디파이어+스크롤 보정이 적용된 값 — snapMin이 오토스크롤 잔여 오프셋을 재스냅.
  // 스토어 쓰기는 제스처당 이 1회(§3.2), moveBlock이 5분 불변식·길이 보존을 재강제(§3.1).
  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setDraggingId(null); // 드롭 시 lane 1회 재계산(§4.6)
    const { blocks: all, moveBlock } = useBlocksStore.getState();
    const block = all[String(e.active.id)];
    if (!block) return;
    const len = block.endMin - block.startMin;
    const newStart = clamp(
      block.startMin + snapMin(yToMinutes(e.delta.y), GESTURE_SNAP),
      0,
      DAY_MINUTES - len,
    );
    moveBlock(block.id, newStart);
  }, []);

  const handleDragCancel = useCallback(() => setDraggingId(null), []);

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
      <div
        {...surfaceHandlers}
        className="relative touch-pan-y select-none [-webkit-touch-callout:none]"
        style={{ height: DAY_HEIGHT }}
      >
        <TimelineGrid />
        {/* 빈 날 상태(§6.5) — 09:00–11:00 밴드 절대 배치, 은은한 힌트. 상호작용 불가침. */}
        {showEmptyHint && (
          <div
            className="pointer-events-none absolute right-2 flex items-center justify-center text-base text-text-tertiary"
            style={{
              top: minutesToY(EMPTY_HINT_START_MIN),
              height: minutesToY(EMPTY_HINT_END_MIN) - minutesToY(EMPTY_HINT_START_MIN),
              left: RULER_WIDTH,
            }}
          >
            {STRINGS.timeline.emptyDay}
          </div>
        )}
        <DndContext
          sensors={sensors}
          modifiers={MOVE_MODIFIERS}
          autoScroll={MOVE_AUTOSCROLL}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {dayBlocks.map((b) => (
            <TimeBlockCard
              key={b.id}
              id={b.id}
              lane={lanes[b.id]?.lane ?? 0}
              laneCount={lanes[b.id]?.laneCount ?? 1}
              scrollerRef={scrollerRef}
            />
          ))}
        </DndContext>
        <DragCreateGhost draft={draft} />
        <NowLine />
      </div>
    </main>
  );
}
