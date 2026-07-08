import { useEffect, useMemo, useRef, type RefObject } from 'react';

// 엣지 오토스크롤 — DESIGN.md §4.4
// 커스텀 제스처 공용: 드래그 생성(Stage 4) + 핸들 리사이즈(Stage 5).
// dnd-kit 블록 이동은 내장 autoScroll을 쓰므로(§4.3) 이 훅과 무관.
// - start()에서 rAF 루프 시작, stop()에서 해제 — 휴지 상태 러닝 루프 0개.
// - 컨테이너 rect는 start() 1회 캐시(§4.1 공통 규칙 — 프레임마다 재계산 금지.
//   회전/리사이즈 시엔 제스처 자체가 중단되므로(§4.10-4) stale rect 없음).
// - 포인터가 상/하 EDGE_ZONE_PX 이내면 근접 비례(최대 MAX_STEP_PX/frame)로 스크롤.
//   실제 스크롤된 프레임마다 onScrolled 콜백 — 포인터가 멈춰 있어도 콘텐츠가
//   흐르므로 호출자가 라이브 scrollTop으로 프리뷰를 재계산해야 한다(§4.10-7).

const EDGE_ZONE_PX = 48; // 컨테이너 상하 감지 영역(§4.4)
const MAX_STEP_PX = 12;  // 프레임당 최대 스크롤량(§4.4)

export interface EdgeAutoScroll {
  /** 제스처 확정(무장/드래그 시작) 시 호출 — clientY는 현재 포인터 y */
  start(clientY: number, onScrolled: () => void): void;
  /** 매 pointermove마다 최신 포인터 y 전달 */
  update(clientY: number): void;
  /** pointer-up/cancel 시 호출 — rAF 루프 해제 */
  stop(): void;
}

export function useEdgeAutoScroll(scrollerRef: RefObject<HTMLElement | null>): EdgeAutoScroll {
  const rafRef = useRef<number | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const clientYRef = useRef(0);
  const onScrolledRef = useRef<(() => void) | null>(null);

  const api = useMemo<EdgeAutoScroll>(() => {
    function stop() {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      rectRef.current = null;
      onScrolledRef.current = null;
    }

    function frame() {
      const el = scrollerRef.current;
      const rect = rectRef.current;
      if (!el || !rect) {
        stop();
        return;
      }
      const y = clientYRef.current;
      // 근접 비례 강도: 엣지에 닿으면 1, EDGE_ZONE_PX 경계에서 0
      const topIntensity = (rect.top + EDGE_ZONE_PX - y) / EDGE_ZONE_PX;
      const bottomIntensity = (y - (rect.bottom - EDGE_ZONE_PX)) / EDGE_ZONE_PX;
      let step = 0;
      if (topIntensity > 0) step = -Math.min(topIntensity, 1) * MAX_STEP_PX;
      else if (bottomIntensity > 0) step = Math.min(bottomIntensity, 1) * MAX_STEP_PX;
      if (step !== 0) {
        const prev = el.scrollTop;
        el.scrollTop = prev + step; // 브라우저가 [0, max]로 자체 클램프
        if (el.scrollTop !== prev) onScrolledRef.current?.();
      }
      rafRef.current = requestAnimationFrame(frame);
    }

    return {
      start(clientY, onScrolled) {
        const el = scrollerRef.current;
        if (!el || rafRef.current !== null) return; // 이미 구동 중이면 무시(제스처당 1루프)
        rectRef.current = el.getBoundingClientRect(); // 1회 캐시(§4.1)
        clientYRef.current = clientY;
        onScrolledRef.current = onScrolled;
        rafRef.current = requestAnimationFrame(frame);
      },
      update(clientY) {
        clientYRef.current = clientY;
      },
      stop,
    };
  }, [scrollerRef]);

  // 언마운트 시 잔여 rAF 해제(소유 제스처 훅이 stop을 놓친 극단 케이스 방어)
  useEffect(() => api.stop, [api]);

  return api;
}
