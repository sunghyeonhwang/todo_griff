import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import {
  DAY_MINUTES,
  GESTURE_SNAP,
  MIN_DURATION,
  clamp,
  clientYToContentY,
  snapMin,
  yToMinutes,
} from '../lib/time';
import { useBlocksStore } from '../store/blocksStore';
import { useEdgeAutoScroll } from './useEdgeAutoScroll';

// 핸들 리사이즈 — DESIGN.md §4.4 (커스텀 Pointer Events, dnd-kit 미사용)
//
// 터치 매트릭스(§4.5 — 핸들 위에서의 승자):
//   핸들 pointerdown           → 즉시 리사이즈 (핸들 자체가 의도 표명 — 롱프레스 없음).
//                                touch-action: none이라 스크롤 후보 자체가 없고,
//                                stopPropagation이 카드(dnd 이동)·캔버스(드래그 생성)
//                                pointerdown 도달을 차단 + data-no-dnd가 dnd 센서 활성화 거부(§4.3)
//   pointercancel·회전(§4.10-4·5) → 프리뷰 조용히 폐기, 스토어 무변경
//   두 번째 포인터(§4.10-6)     → 무시 (단일 pointerId만 추적)
//
// - 엣지(포인터 지점)는 15분 스냅(GESTURE_SNAP), 반대편 고정:
//   위 핸들 newStart = clamp(edge, 0, end-15) / 아래 핸들 newEnd = clamp(edge, start+15, 1440)
//   — 반대편을 넘어가면 최소 15분에서 클램프, 반전·이동 전환 없음(§4.10-2).
// - 프리뷰는 훅 로컬 상태(§3.2) — resizeBlock 커밋은 pointer-up의 1회뿐(§3.1).
//   탭(무이동)으로 끝나면 스토어 무변경.
// - rect는 pointerdown 1회 캐시 + scrollTop은 move마다 라이브(§4.1), move는 rAF 배칭.
// - 엣지 오토스크롤은 useEdgeAutoScroll 재사용(§4.4) — 첫 move에 시작
//   (press 지점이 이미 엣지 존이어도 의도 확인 전에 스크롤하지 않음).

export type ResizeEdge = 'top' | 'bottom';

/** 진행 중 리사이즈 프리뷰 — 카드가 top/height·캡션에 반영 */
export interface ResizePreview {
  startMin: number;
  endMin: number;
}

/** ResizeHandle에 스프레드할 핸들러 묶음 */
export interface ResizeHandleHandlers {
  onPointerDown(e: ReactPointerEvent<HTMLDivElement>): void;
  onPointerMove(e: ReactPointerEvent<HTMLDivElement>): void;
  onPointerUp(e: ReactPointerEvent<HTMLDivElement>): void;
  onPointerCancel(e: ReactPointerEvent<HTMLDivElement>): void;
}

interface Gesture {
  pointerId: number;
  edge: ResizeEdge;
  captureEl: HTMLElement; // setPointerCapture 대상 = 핸들
  scroller: HTMLElement;
  rect: DOMRect; // 스크롤러 rect — pointerdown 1회 캐시(§4.1)
  fixedStart: number; // 제스처 시작 시점 블록 범위 — 반대편 고정 기준(§4.4)
  fixedEnd: number;
  lastClientY: number;
  moved: boolean; // false로 끝나면(탭) 스토어 무변경
  rafId: number | null; // move rAF 배칭
}

export function useResizeBlock(
  scrollerRef: RefObject<HTMLElement | null>,
  blockId: string,
): {
  preview: ResizePreview | null;
  resizing: boolean;
  handleHandlers: Record<ResizeEdge, ResizeHandleHandlers>;
} {
  const [preview, setPreview] = useState<ResizePreview | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const autoScroll = useEdgeAutoScroll(scrollerRef);

  const api = useMemo(() => {
    /** 엣지 후보(15분 스냅) → 반대편 고정 + 최소 15분 + 일 경계(§4.4) */
    function rangeAt(g: Gesture, clientY: number): ResizePreview {
      const contentY = clientYToContentY(clientY, g.rect, g.scroller.scrollTop); // scrollTop 라이브(§4.1)
      const edgeMin = snapMin(yToMinutes(contentY), GESTURE_SNAP);
      return g.edge === 'top'
        ? { startMin: clamp(edgeMin, 0, g.fixedEnd - MIN_DURATION), endMin: g.fixedEnd }
        : { startMin: g.fixedStart, endMin: clamp(edgeMin, g.fixedStart + MIN_DURATION, DAY_MINUTES) };
    }

    function applyPreview() {
      const g = gestureRef.current;
      if (!g || !g.moved) return;
      const range = rangeAt(g, g.lastClientY);
      // 값 동일 시 참조 유지 — 스냅 경계를 안 넘은 move는 리렌더 없음
      setPreview((prev) =>
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

    /** 공통 해제 — rAF·리스너·캡처·오토스크롤. 프리뷰·스토어는 건드리지 않음 */
    function teardown() {
      const g = gestureRef.current;
      if (!g) return;
      if (g.rafId !== null) cancelAnimationFrame(g.rafId);
      window.removeEventListener('resize', abort);
      autoScroll.stop();
      try {
        g.captureEl.releasePointerCapture(g.pointerId);
      } catch {
        // 이미 브라우저가 해제(pointercancel 등) — 무시
      }
      gestureRef.current = null;
    }

    /** pointercancel·회전·언마운트: 프리뷰 조용히 폐기, 스토어 무변경(§4.10-4·5) */
    function abort() {
      if (!gestureRef.current) return;
      teardown();
      setPreview(null);
    }

    function makeHandlers(edge: ResizeEdge): ResizeHandleHandlers {
      return {
        onPointerDown(e) {
          if (gestureRef.current || !e.isPrimary) return; // 단일 pointerId만 추적(§4.10-6)
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          e.stopPropagation(); // 카드 dnd 이동·캔버스 드래그 생성 pointerdown 차단(§4.4)
          const scroller = scrollerRef.current;
          const block = useBlocksStore.getState().blocks[blockId];
          if (!scroller || !block) return;

          const captureEl = e.currentTarget;
          const g: Gesture = {
            pointerId: e.pointerId,
            edge,
            captureEl,
            scroller,
            rect: scroller.getBoundingClientRect(), // pointerdown 1회 캐시(§4.1)
            fixedStart: block.startMin,
            fixedEnd: block.endMin,
            lastClientY: e.clientY,
            moved: false,
            rafId: null,
          };
          gestureRef.current = g;
          captureEl.setPointerCapture(e.pointerId); // 커스텀 제스처 필수
          window.addEventListener('resize', abort); // 회전/리사이즈 → 제스처 중단(§4.10-4)
          // 제스처 진행 표시 — 핸들이 hover 이탈로 언마운트되지 않게 카드가 이 상태를 게이트
          setPreview({ startMin: block.startMin, endMin: block.endMin });
        },

        onPointerMove(e) {
          const g = gestureRef.current;
          if (!g || e.pointerId !== g.pointerId) return;
          g.lastClientY = e.clientY;
          if (!g.moved) {
            g.moved = true;
            // 스크롤 프레임마다 프리뷰 재계산 — 포인터 정지 중에도 콘텐츠가 흐름(§4.10-7)
            autoScroll.start(e.clientY, applyPreview);
          }
          autoScroll.update(e.clientY);
          schedulePreview(); // rAF 배칭(§4.1) — 프레임당 1회만 상태 갱신
        },

        onPointerUp(e) {
          const g = gestureRef.current;
          if (!g || e.pointerId !== g.pointerId) return;
          // 릴리즈 지점 기준 최종 확정(프리뷰 rAF 지연과 무관) → resizeBlock 1회(§3.2).
          // 무이동(탭)이면 스토어 무변경. 스토어가 5분 불변식·경계를 재강제(§3.1).
          const range = g.moved ? rangeAt(g, e.clientY) : null;
          const gestureEdge = g.edge;
          teardown();
          setPreview(null);
          if (range) {
            const edgeMin = gestureEdge === 'top' ? range.startMin : range.endMin;
            useBlocksStore.getState().resizeBlock(blockId, gestureEdge, edgeMin);
          }
        },

        onPointerCancel(e) {
          const g = gestureRef.current;
          if (g && e.pointerId === g.pointerId) abort(); // iOS 시스템 제스처·전화 수신(§4.5)
        },
      };
    }

    return {
      abort,
      handleHandlers: { top: makeHandlers('top'), bottom: makeHandlers('bottom') },
    };
  }, [autoScroll, blockId, scrollerRef]);

  // 언마운트 시 진행 중 제스처 정리(리스너·rAF 누수 방지)
  useEffect(() => api.abort, [api]);

  return { preview, resizing: preview !== null, handleHandlers: api.handleHandlers };
}
