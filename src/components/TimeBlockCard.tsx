import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useDraggable } from '@dnd-kit/core';
import ResizeHandle from './ResizeHandle';
import { useResizeBlock } from '../hooks/useResizeBlock';
import {
  CAPTION_MIN_HEIGHT,
  DAY_MINUTES,
  GESTURE_SNAP,
  RULER_WIDTH,
  clamp,
  formatMinutes,
  minutesToY,
  snapMin,
  yToMinutes,
} from '../lib/time';
import { STRINGS } from '../lib/strings';
import { useBlocksStore } from '../store/blocksStore';
import { useUiStore } from '../store/uiStore';

// 블록 카드 — DESIGN.md §4.8 + 이동(§4.3)·리사이즈(§4.4) 장착 (Stage 5)
// - 위치/높이 = minutesToY만(인라인 픽셀 계산 금지). 좌 인셋 거터(RULER_WIDTH) ~ 우측 8px,
//   풀폭 렌더 — 겹침 lane 분할은 Stage 6(lanes.ts).
// - 엔티티 구독: s.blocks[id] 참조 동일성 — 무관한 변경에 리렌더 없음(§3.3).
// - 이동(dnd-kit, DragOverlay 미사용 §4.3): 카드 자체를 in-place transform —
//   translate3d(0, Δy, 0) + scale 1.02 + shadow-lg + z-dragging(30). transform.y는
//   모디파이어(세로·24px 스냅·부모 제한)+스크롤 보정 적용값이라 시간 배지가 onDragEnd와
//   동일한 수식(15분 스냅+경계 클램프)으로 커밋될 값을 그대로 보여준다.
// - 드래그 후 클릭 가드: dnd 활성화 제약(마우스 4px)이 자연 억제 + wasDraggedRef 이중 가드
//   (§4.9) — 드롭 직후 합성 click 1회만 무시, 새 pointerdown마다 해제.
// - 선택 모델(§4.4·§4.10-9·10): 터치 300ms 롱프레스(=dnd 활성화)가 선택 겸용 —
//   Timeline onDragStart가 select. 핸들 노출 = 데스크톱 hover ∥ 선택 ∥ 리사이즈 진행 중
//   (진행 중엔 hover 이탈에도 언마운트 금지 — 포인터 캡처 유지). 드래그 중에는 숨김.
// - 리사이즈 프리뷰(훅 로컬 §3.2)가 top/height·캡션을 라이브 반영 — 커밋은 pointer-up 1회.
// - z-order(§4.6): 드래그 중 z-dragging(30) / 선택·리사이즈 중 15 / 기본 z-block(10).
// - 카드는 포커스 가능한 role="button"(Enter/Space → 에디터, §4.8) — 내부에 체크박스가 있어
//   <button> 중첩을 피한다. dnd attributes 스프레드는 의도적 미사용:
//   KeyboardSensor 미사용(§4.8 문서화된 결정)이라 aria-roledescription이 오도만 한다.
// - 체크박스는 마크업만(24px 원 + aria + data-no-dnd + stopPropagation) —
//   토글 배선·44px 히트영역·완료 비주얼은 Stage 6(§4.9).
// - pointerdown stopPropagation: 빈 면 드래그 생성(§4.2)이 카드 위에서 시작되지 않게
//   캔버스 핸들러 도달을 차단 — dnd 센서는 mousedown/touchstart를 들어 영향 없음(§4.3).
//   + contextmenu preventDefault / touch-callout 차단(§4.5 하드닝 — 카드·면 공통).

const DRAG_SCALE = 1.02; // §4.3 — in-place transform의 드래그 중 확대 배율

export default function TimeBlockCard({
  id,
  scrollerRef,
}: {
  id: string;
  scrollerRef: RefObject<HTMLElement | null>;
}) {
  const block = useBlocksStore((s) => s.blocks[id]);
  const openEdit = useUiStore((s) => s.openEdit);
  const selected = useUiStore((s) => s.selectedBlockId === id);
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const { preview, resizing, handleHandlers } = useResizeBlock(scrollerRef, id);
  const [hovered, setHovered] = useState(false); // 마우스 전용 — 핸들 노출 게이트(§4.4)

  // 드래그 직후 합성 click 가드(§4.9) — isDragging 이력을 기록, click에서 1회 소비
  const wasDraggedRef = useRef(false);
  useEffect(() => {
    if (isDragging) wasDraggedRef.current = true;
  }, [isDragging]);

  if (!block) return null;

  // 리사이즈 프리뷰가 있으면 그 범위로 렌더(§4.4) — 스토어는 pointer-up까지 불변
  const startMin = preview?.startMin ?? block.startMin;
  const endMin = preview?.endMin ?? block.endMin;
  const top = minutesToY(startMin);
  const height = minutesToY(endMin) - top;
  // 시간 캡션은 높이 ≥ 40px(25분)일 때만 — 15분 블록(24px)은 이모지+제목 한 줄(§4.8)
  const showCaption = height >= CAPTION_MIN_HEIGHT;

  // 이동 중 시간 배지(§4.3) — onDragEnd 커밋 수식과 동일: 배지 = 커밋될 값
  const len = block.endMin - block.startMin;
  const dragStartMin = isDragging
    ? clamp(
        block.startMin + snapMin(yToMinutes(transform?.y ?? 0), GESTURE_SNAP),
        0,
        DAY_MINUTES - len,
      )
    : block.startMin;

  const showHandles = !isDragging && (selected || hovered || resizing);
  const zClass = isDragging ? 'z-(--z-dragging)' : selected || resizing ? 'z-15' : 'z-(--z-block)';

  const open = () => openEdit(id);

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      data-color={block.color}
      {...listeners}
      onClick={() => {
        if (wasDraggedRef.current) {
          wasDraggedRef.current = false; // 드롭 직후 합성 클릭 1회 무시(§4.9)
          return;
        }
        open();
      }}
      onPointerDown={(e) => {
        e.stopPropagation(); // 캔버스 드래그 생성 차단(§4.2)
        wasDraggedRef.current = false; // 새 제스처 — 이전 드래그 플래그 해제
      }}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') setHovered(true); // 터치 hover 에뮬레이션 배제(§4.4)
      }}
      onPointerLeave={() => setHovered(false)}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      className={`absolute right-2 touch-pan-y rounded-md outline-none select-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-accent-primary ${zClass}`}
      style={{
        top,
        height,
        left: RULER_WIDTH,
        // translate 먼저·scale 나중(문자열 합성) — Δy가 화면 픽셀 그대로 유지되고 확대는 로컬
        transform:
          isDragging && transform
            ? `translate3d(0, ${transform.y}px, 0) scale(${DRAG_SCALE})`
            : undefined,
      }}
    >
      {/* 시각 본체 — overflow 클립은 여기서만(루트가 클립하면 배지·핸들 바깥 12px이 잘림) */}
      <div
        className={`relative h-full overflow-hidden rounded-md bg-(--blk-bg) ${
          isDragging ? 'shadow-lg' : 'shadow-block'
        }`}
      >
        {/* 좌측 3px 라운드 액센트 바(§4.8) */}
        <span aria-hidden className="absolute top-1 bottom-1 left-1 w-[3px] rounded-full bg-(--blk-solid)" />
        {/* 내용 행: 이모지(16px) + 한 줄 말줄임 제목 + 우측 체크박스 — 행 높이 24px = 최소 블록 */}
        <div className="flex h-6 items-center gap-1.5 pr-1.5 pl-3">
          <span aria-hidden className="text-[16px] leading-none">
            {block.emoji}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-(--blk-fg)">
            {block.title}
          </span>
          <button
            type="button"
            data-no-dnd
            aria-label={STRINGS.card.completeLabel}
            aria-pressed={block.completed}
            onClick={(e) => e.stopPropagation()}
            className={`size-6 shrink-0 rounded-full border-2 border-(--blk-solid) ${
              block.completed ? 'bg-(--blk-solid)' : ''
            }`}
          />
        </div>
        {showCaption && (
          <div className="pl-3 text-xs tabular-nums text-(--blk-fg) opacity-70">
            {formatMinutes(startMin)} – {formatMinutes(endMin)}
          </div>
        )}
      </div>
      {/* 이동 중 시간 배지(§4.3) — 카드 좌상단 바깥, 카드와 함께 transform */}
      {isDragging && (
        <div
          aria-hidden
          className="absolute bottom-full left-0 mb-1 rounded-sm bg-surface-card-elevated px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap tabular-nums text-text-primary shadow-md"
        >
          {formatMinutes(dragStartMin)} – {formatMinutes(dragStartMin + len)}
        </div>
      )}
      {showHandles && (
        <>
          <ResizeHandle edge="top" handlers={handleHandlers.top} />
          <ResizeHandle edge="bottom" handlers={handleHandlers.bottom} />
        </>
      )}
    </div>
  );
}
