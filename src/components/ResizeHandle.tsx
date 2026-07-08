import type { ResizeEdge, ResizeHandleHandlers } from '../hooks/useResizeBlock';

// 리사이즈 핸들 — DESIGN.md §4.4
// - 히트 영역: 카드 폭 × 24px(h-6), 카드 경계 안팎 12px씩(-top-3/-bottom-3) —
//   카드 루트가 overflow를 클립하지 않으므로 바깥 12px도 유효.
// - 시각 어포던스: 32×4px 필(w-8 h-1), 색 --blk-solid — 카드의 data-color 브리지 상속(§6.2).
// - touch-action: none(§4.5 표 — 노출 시에만 존재하는 작은 타깃이라 허용):
//   이 터치는 스크롤 후보가 아니므로 non-passive 리스너 없이도 즉시 리사이즈.
// - data-no-dnd: 부모 카드의 dnd 이동 센서 활성화 거부(§4.3) —
//   pointerdown stopPropagation은 훅 핸들러(useResizeBlock)가 수행.
// - 포인터 전용 어포던스(aria-hidden) — 키보드 시간 조정 경로는 에디터 time input(§4.8).

export default function ResizeHandle({
  edge,
  handlers,
}: {
  edge: ResizeEdge;
  handlers: ResizeHandleHandlers;
}) {
  return (
    <div
      {...handlers}
      aria-hidden
      data-no-dnd
      // 리사이즈 pointerup 뒤 브라우저 호환 click이 카드 onClick으로 버블되어
      // 에디터가 열리는 것을 차단(§4.4 — 핸들 릴리즈는 편집 진입이 아니다).
      onClick={(e) => e.stopPropagation()}
      className={`absolute inset-x-0 flex h-6 cursor-ns-resize touch-none items-center justify-center ${
        edge === 'top' ? '-top-3' : '-bottom-3'
      }`}
    >
      <span className="h-1 w-8 rounded-full bg-(--blk-solid)" />
    </div>
  );
}
