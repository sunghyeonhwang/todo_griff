import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import {
  DAY_MINUTES,
  DEFAULT_DURATION,
  GESTURE_SNAP,
  MIN_DURATION,
  clamp,
  clientYToContentY,
  snapMin,
  yToMinutes,
} from '../lib/time';
import { useUiStore } from '../store/uiStore';
import { useEdgeAutoScroll } from './useEdgeAutoScroll';

// 빈 캔버스 드래그 생성 — DESIGN.md §4.2 (커스텀 Pointer Events, dnd-kit 미사용)
//
// 터치 매트릭스(§4.5 — 빈 면에서의 승자):
//   무장 전 >10px 이동          → 네이티브 스크롤 (touch-action: pan-y, 후보 폐기)
//   400ms 홀드(이동 ≤10px)      → 드래그 생성 무장 — 이 시점부터 non-passive touchmove
//                                 preventDefault 등록(종료 시 해제 — 휴지 상태 리스너 0개)
//   무장 전 릴리즈(≤10px)       → 플레인 탭 (선택 존재 시 해제만 소비 §4.10-10,
//                                 아니면 15분 스냅 지점 + 60분 드래프트 에디터)
//   마우스 ≥6px 이동            → 드래프트 즉시 시작 / <6px 릴리즈 → 플레인 탭
//   블록 카드 위 pointerdown    → 카드가 stopPropagation — 이 훅에 도달하지 않음
//   pointercancel·회전(§4.10-4·5) → 드래프트 조용히 폐기, 스토어 무변경
//   두 번째 포인터(§4.10-6)     → 무시 (단일 pointerId만 추적)
//
// - 프리뷰는 훅 로컬 상태(§3.2) — 스토어는 릴리즈의 openCreate만 안다. 스토어 쓰기 없음:
//   addBlock은 에디터 저장 버튼의 1회뿐(§4.2), 취소 시 잔여물 제로.
// - rect는 pointerdown 1회 캐시 + scrollTop은 move마다 라이브(§4.1). move 핸들러는 rAF 배칭.
// - 앵커·현재 지점 모두 15분 스냅(GESTURE_SNAP), 위로 드래그 허용([min,max]), 최소 15분,
//   [0, 1440] 클램프(§4.10-1).

const MOUSE_DRAG_SLOP_PX = 6;   // §4.2 마우스: 6px 이동 시 드래프트 시작, 미만이면 탭
const TOUCH_ARM_DELAY_MS = 400; // §4.2 터치: 롱프레스 400ms 무장 — 이동(300ms)보다 의도적으로 길게
const TOUCH_ARM_SLOP_PX = 10;   // §4.2 무장 전 10px 초과 이동 → 취소, 네이티브 스크롤 진행

/** 진행 중 드래프트 프리뷰 — DragCreateGhost가 렌더 */
export interface CreateDraftPreview {
  startMin: number;
  endMin: number;
}

/** 캔버스(빈 면)에 스프레드할 핸들러 묶음 */
export interface DragCreateSurfaceHandlers {
  onPointerDown(e: ReactPointerEvent<HTMLDivElement>): void;
  onPointerMove(e: ReactPointerEvent<HTMLDivElement>): void;
  onPointerUp(e: ReactPointerEvent<HTMLDivElement>): void;
  onPointerCancel(e: ReactPointerEvent<HTMLDivElement>): void;
  onContextMenu(e: ReactMouseEvent<HTMLDivElement>): void;
}

interface Gesture {
  pointerId: number;
  isMouse: boolean;         // pointerType 'mouse' 외(터치·펜)는 전부 롱프레스 경로
  captureEl: HTMLElement;   // setPointerCapture 대상 = 캔버스 면
  scroller: HTMLElement;
  rect: DOMRect;            // 스크롤러 rect — pointerdown 1회 캐시(§4.1)
  downClientX: number;
  downClientY: number;
  lastClientY: number;
  anchorMin: number;        // 다운 지점 15분 스냅(§4.2)
  phase: 'pending' | 'dragging';
  armTimer: number | null;  // 터치 400ms 무장 타이머
  rafId: number | null;     // move rAF 배칭
}

/** 앵커·현재 지점(15분 스냅·클램프 완료) → [min,max] + 최소 15분 + 일 경계(§4.2, §4.10-1) */
function draftRange(anchorMin: number, currentMin: number): CreateDraftPreview {
  let lo = Math.min(anchorMin, currentMin);
  let hi = Math.max(anchorMin, currentMin);
  if (hi - lo < MIN_DURATION) hi = lo + MIN_DURATION;
  if (hi > DAY_MINUTES) {
    hi = DAY_MINUTES;
    lo = DAY_MINUTES - MIN_DURATION;
  }
  return { startMin: lo, endMin: hi };
}

export function useDragCreate(scrollerRef: RefObject<HTMLElement | null>): {
  draft: CreateDraftPreview | null;
  surfaceHandlers: DragCreateSurfaceHandlers;
} {
  const [draft, setDraft] = useState<CreateDraftPreview | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const autoScroll = useEdgeAutoScroll(scrollerRef);

  // 무장 후에만 등록되는 non-passive 스크롤 블로커 — 휴지 상태 터치 리스너 0개(§4.5).
  // 진행 중 제스처에 touch-action 변경은 iOS에서 무효이므로 이 경로가 규범(§4.2).
  const blockTouchMove = useRef((e: TouchEvent) => e.preventDefault()).current;

  const api = useMemo(() => {
    /** clientY → 15분 스냅 + [0,1440] 클램프된 분. scrollTop은 호출 시점 라이브(§4.1) */
    function snappedMinAt(clientY: number, rect: DOMRect, scroller: HTMLElement): number {
      const contentY = clientYToContentY(clientY, rect, scroller.scrollTop);
      return clamp(snapMin(yToMinutes(contentY), GESTURE_SNAP), 0, DAY_MINUTES);
    }

    function applyPreview() {
      const g = gestureRef.current;
      if (!g || g.phase !== 'dragging') return;
      const range = draftRange(g.anchorMin, snappedMinAt(g.lastClientY, g.rect, g.scroller));
      // 값 동일 시 참조 유지 — 스냅 경계를 안 넘은 move는 리렌더 없음
      setDraft((prev) =>
        prev && prev.startMin === range.startMin && prev.endMin === range.endMin ? prev : range,
      );
    }

    function schedulePreview() {
      const g = gestureRef.current;
      if (!g || g.rafId !== null) return;
      g.rafId = requestAnimationFrame(() => {
        const cur = gestureRef.current;
        if (cur) cur.rafId = null;
        applyPreview();
      });
    }

    /** 공통 해제 — 타이머·rAF·리스너·캡처·오토스크롤. 스토어·프리뷰는 건드리지 않음 */
    function teardown() {
      const g = gestureRef.current;
      if (!g) return;
      if (g.armTimer !== null) window.clearTimeout(g.armTimer);
      if (g.rafId !== null) cancelAnimationFrame(g.rafId);
      window.removeEventListener('touchmove', blockTouchMove);
      window.removeEventListener('resize', abort);
      autoScroll.stop();
      try {
        g.captureEl.releasePointerCapture(g.pointerId);
      } catch {
        // 이미 브라우저가 해제(pointercancel 등) — 무시
      }
      gestureRef.current = null;
    }

    /** pointercancel·회전·언마운트: 드래프트 조용히 폐기, 스토어 무변경(§4.10-4·5) */
    function abort() {
      if (!gestureRef.current) return;
      teardown();
      setDraft(null);
    }

    /** 드래프트 시작 — 마우스 6px 초과 or 터치 400ms 무장(§4.2) */
    function beginDrag() {
      const g = gestureRef.current;
      if (!g || g.phase !== 'pending') return;
      if (g.armTimer !== null) {
        window.clearTimeout(g.armTimer);
        g.armTimer = null;
      }
      g.phase = 'dragging';
      if (!g.isMouse) window.addEventListener('touchmove', blockTouchMove, { passive: false });
      autoScroll.start(g.lastClientY, applyPreview); // 스크롤 프레임마다 프리뷰 재계산(§4.4)
      applyPreview();
    }

    function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
      if (gestureRef.current || !e.isPrimary) return; // 단일 pointerId만 추적(§4.10-6)
      const isMouse = e.pointerType === 'mouse';
      if (isMouse && e.button !== 0) return;
      if (useUiStore.getState().editor.mode !== 'closed') return; // 시트 열림 중 무시(멱등 §4.9)
      const scroller = scrollerRef.current;
      if (!scroller) return;

      const captureEl = e.currentTarget;
      const rect = scroller.getBoundingClientRect(); // pointerdown 1회 캐시(§4.1)
      const g: Gesture = {
        pointerId: e.pointerId,
        isMouse,
        captureEl,
        scroller,
        rect,
        downClientX: e.clientX,
        downClientY: e.clientY,
        lastClientY: e.clientY,
        anchorMin: snappedMinAt(e.clientY, rect, scroller),
        phase: 'pending',
        armTimer: null,
        rafId: null,
      };
      gestureRef.current = g;
      captureEl.setPointerCapture(e.pointerId); // 커스텀 제스처 필수
      window.addEventListener('resize', abort); // 회전/리사이즈 → 진행 중 제스처 중단(§4.10-4)
      if (!isMouse) g.armTimer = window.setTimeout(beginDrag, TOUCH_ARM_DELAY_MS);
    }

    function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
      const g = gestureRef.current;
      if (!g || e.pointerId !== g.pointerId) return;
      g.lastClientY = e.clientY;
      if (g.phase === 'pending') {
        const dist = Math.hypot(e.clientX - g.downClientX, e.clientY - g.downClientY);
        if (g.isMouse) {
          if (dist >= MOUSE_DRAG_SLOP_PX) beginDrag();
        } else if (dist > TOUCH_ARM_SLOP_PX) {
          abort(); // 무장 전 이동 초과 → 네이티브 스크롤에 양보(§4.2)
        }
        return;
      }
      autoScroll.update(e.clientY);
      schedulePreview(); // rAF 배칭(§4.1) — 프레임당 1회만 상태 갱신
    }

    function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
      const g = gestureRef.current;
      if (!g || e.pointerId !== g.pointerId) return;
      const { openCreate, select, selectedBlockId, activeDateKey } = useUiStore.getState();

      if (g.phase === 'dragging') {
        // 릴리즈 지점 기준 최종 확정(프리뷰 rAF 지연과 무관) → openCreate — 스토어 무변경(§4.2).
        // 이후 고스트는 editor.draft에서 계속 렌더, addBlock은 에디터 저장 버튼의 1회뿐.
        const range = draftRange(g.anchorMin, snappedMinAt(e.clientY, g.rect, g.scroller));
        teardown();
        setDraft(null);
        openCreate({ dateKey: activeDateKey, ...range });
        return;
      }

      // 플레인 탭(마우스 <6px · 터치 <400ms & ≤10px)
      teardown();
      if (selectedBlockId !== null) {
        select(null); // 첫 탭은 선택 해제만 하고 소비 — 에디터 안 열림(§4.10-10)
        return;
      }
      // 탭 지점 15분 스냅 + 60분 길이 드래프트(§4.2) — 자정 근처는 일 경계로 축소
      const startMin = clamp(g.anchorMin, 0, DAY_MINUTES - MIN_DURATION);
      const endMin = Math.min(startMin + DEFAULT_DURATION, DAY_MINUTES);
      openCreate({ dateKey: activeDateKey, startMin, endMin });
    }

    function onPointerCancel(e: ReactPointerEvent<HTMLDivElement>) {
      const g = gestureRef.current;
      if (g && e.pointerId === g.pointerId) abort(); // iOS 시스템 제스처·전화 수신(§4.5)
    }

    const surfaceHandlers: DragCreateSurfaceHandlers = {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onContextMenu: (e) => e.preventDefault(), // 롱프레스 콜아웃 차단(§4.5 하드닝)
    };

    return { surfaceHandlers, abort };
  }, [autoScroll, blockTouchMove, scrollerRef]);

  // 언마운트 시 진행 중 제스처 정리(리스너·타이머 누수 방지)
  useEffect(() => api.abort, [api]);

  return { draft, surfaceHandlers: api.surfaceHandlers };
}
