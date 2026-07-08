import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useDraggable } from '@dnd-kit/core';
import ResizeHandle from './ResizeHandle';
import { useResizeBlock } from '../hooks/useResizeBlock';
import {
  CAPTION_MIN_HEIGHT,
  CARD_INSET_RIGHT,
  DAY_MINUTES,
  GESTURE_SNAP,
  LANE_GAP,
  RULER_WIDTH,
  clamp,
  formatMinutes,
  minutesToY,
  snapMin,
  yToMinutes,
} from '../lib/time';
import { Z_INDEX } from '../lib/tokens';
import { STRINGS } from '../lib/strings';
import { resolveIcon } from '../lib/icons';
import { useBlocksStore } from '../store/blocksStore';
import { useUiStore } from '../store/uiStore';

// 블록 카드 — DESIGN.md §4.8 + 이동(§4.3)·리사이즈(§4.4)·완료(§4.9)·겹침 lane(§4.6)
// - 위치/높이 = minutesToY만(인라인 픽셀 계산 금지). 가로 = 거터(RULER_WIDTH) ~ 우측
//   CARD_INSET_RIGHT 트랙을 laneCount 균등 분할(§4.6) — lane은 Timeline의 computeLanes
//   useMemo가 계산해 props로 내려준다. 둘째 lane부터 LANE_GAP 시각 간격.
// - 이동 드래그 중(§4.6): lane 계산에서 제외(Timeline이 excludeId 전달)되므로 props는
//   풀폭(lane 0/1)이 되고, 카드는 opacity 90% + z-dragging(30)으로 위에 렌더.
// - 엔티티 구독: s.blocks[id] 참조 동일성 — 무관한 변경에 리렌더 없음(§3.3).
// - 이동(dnd-kit, DragOverlay 미사용 §4.3): 카드 자체를 in-place transform —
//   translate3d(0, Δy, 0) + scale 1.02 + shadow-lg. transform.y는 모디파이어(세로·24px
//   스냅·부모 제한)+스크롤 보정 적용값이라 시간 배지가 onDragEnd와 동일한 수식으로
//   커밋될 값을 그대로 보여준다.
// - 드래그 후 클릭 가드: dnd 활성화 제약(마우스 4px)이 자연 억제 + wasDraggedRef 이중 가드
//   (§4.9) — 드롭 직후 합성 click 1회만 무시, 새 pointerdown마다 해제.
// - 선택 모델(§4.4·§4.10-9·10): 터치 300ms 롱프레스(=dnd 활성화)가 선택 겸용 —
//   Timeline onDragStart가 select. 핸들 노출 = 데스크톱 hover ∥ 선택 ∥ 리사이즈 진행 중.
// - 리사이즈 프리뷰(훅 로컬 §3.2)가 top/height·캡션을 라이브 반영 — 커밋은 pointer-up 1회.
// - z-order(§4.6): 드래그 z-dragging(30) / 선택·리사이즈 15 / 기본 z-block(10) + lane별 +1.
// - 카드는 포커스 가능한 role="button"(Enter/Space → 에디터, §4.8) — 내부에 체크박스가 있어
//   <button> 중첩을 피한다. keydown은 target === currentTarget일 때만 처리(체크박스
//   Enter/Space가 에디터를 열지 않게). dnd attributes 스프레드는 의도적 미사용:
//   KeyboardSensor 미사용(§4.8 문서화된 결정)이라 aria-roledescription이 오도만 한다.
// - 체크박스(§4.9): 24px 원 + 44×44 히트영역(after 확장, Apple HIG), data-no-dnd +
//   stopPropagation — 에디터 안 열림, toggleComplete 즉시 커밋(명시적 저장의 유일한 예외).
// - 완료 비주얼(§4.9, --duration-fast): 채움 40% 불투명도, 제목 취소선 + text-tertiary,
//   아이콘 배지 50%, 그림자 제거, 체크박스 --blk-solid 채움 + 흰 체크(--text-on-solid).
//   완료 블록도 드래그·리사이즈·편집 가능.
// - pointerdown stopPropagation: 빈 면 드래그 생성(§4.2)이 카드 위에서 시작되지 않게
//   캔버스 핸들러 도달을 차단 — dnd 센서는 mousedown/touchstart를 들어 영향 없음(§4.3).

const DRAG_SCALE = 1.02; // §4.3 — in-place transform의 드래그 중 확대 배율
const Z_SELECTED = 15;   // §4.6 — 선택 블록 z(토큰 맵 외 설계 명시값)

export default function TimeBlockCard({
  id,
  lane = 0,
  laneCount = 1,
  scrollerRef,
}: {
  id: string;
  lane?: number;
  laneCount?: number;
  scrollerRef: RefObject<HTMLElement | null>;
}) {
  const block = useBlocksStore((s) => s.blocks[id]);
  const toggleComplete = useBlocksStore((s) => s.toggleComplete);
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
  // 시간 캡션은 높이 ≥ 40px(25분)일 때만 — 15분 블록(24px)은 아이콘+제목 한 줄(§4.8)
  const showCaption = height >= CAPTION_MIN_HEIGHT;

  // 가로 lane 지오메트리(§4.6) — 트랙(거터~우측 인셋)을 laneCount 균등 분할.
  // 드래그 중엔 Timeline이 lane 계산에서 제외 → props가 풀폭(0/1)으로 내려온다.
  const gap = lane > 0 ? LANE_GAP : 0;
  const track = `100% - ${RULER_WIDTH + CARD_INSET_RIGHT}px`;
  const left = `calc(${RULER_WIDTH}px + (${track}) * ${lane / laneCount} + ${gap}px)`;
  const width = `calc((${track}) / ${laneCount} - ${gap}px)`;

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
  // z-order(§4.6): dragging(30) > 선택·리사이즈(15) > 기본 block(10) + lane별 +1
  const zIndex = isDragging ? Z_INDEX.dragging : selected || resizing ? Z_SELECTED : Z_INDEX.block + lane;

  const open = () => openEdit(id);
  const done = block.completed;

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
        if (e.target !== e.currentTarget) return; // 체크박스 Enter/Space는 카드로 승격 금지(§4.9)
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      className={`absolute touch-pan-y rounded-md outline-none select-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-accent-primary ${
        isDragging ? 'opacity-90' : ''
      }`}
      style={{
        top,
        height,
        left,
        width,
        zIndex,
        // translate 먼저·scale 나중(문자열 합성) — Δy가 화면 픽셀 그대로 유지되고 확대는 로컬
        transform:
          isDragging && transform
            ? `translate3d(0, ${transform.y}px, 0) scale(${DRAG_SCALE})`
            : undefined,
      }}
    >
      {/* 시각 본체 — overflow 클립은 여기서만(루트가 클립하면 배지·핸들 바깥 12px이 잘림)
          완료 시(§4.9): 채움 40%·그림자 제거, --duration-fast 전환 */}
      <div
        className={`relative h-full overflow-hidden rounded-md transition-[background-color,box-shadow] duration-(--duration-fast) ${
          done ? 'bg-(--blk-bg)/40' : 'bg-(--blk-bg)'
        } ${isDragging ? 'shadow-lg' : done ? 'shadow-none' : 'shadow-block'}`}
      >
        {/* 내용(§4.8, Structured 정체성): 원형 아이콘 배지(색 링) + 제목/캡션 스택 + 우측 체크박스.
            콤팩트(<25분, 24px 행)는 배지 축소 + 단일 행. */}
        <div
          className={`flex gap-2 pr-1.5 ${
            showCaption ? 'items-start pt-1.5 pl-2' : 'h-6 items-center pl-1'
          }`}
        >
          {/* 아이콘 직접 렌더 — surface-card 원형 배지(흰/검 테두리) 제거(사용자 요청 2026-07-08).
              색 정체성은 카드 틴트(--blk-bg)로 유지(§4.8). */}
          <img
            aria-hidden
            src={resolveIcon(block.icon).src}
            alt=""
            className={`shrink-0 transition-opacity duration-(--duration-fast) ${
              showCaption ? 'size-7' : 'size-5'
            } ${done ? 'opacity-50' : ''}`}
          />
          <div className="min-w-0 flex-1">
            <div
              className={`truncate text-sm font-semibold transition-colors duration-(--duration-fast) ${
                done ? 'text-text-tertiary line-through' : 'text-(--blk-fg)'
              }`}
            >
              {block.title}
            </div>
            {/* 시간 캡션: 범위 · 소요시간 — 예: "12:45 – 14:30 · 1시간 45분" */}
            {showCaption && (
              <div className="truncate text-xs tabular-nums text-(--blk-fg) opacity-70">
                {formatMinutes(startMin)} – {formatMinutes(endMin)} ·{' '}
                {STRINGS.duration(endMin - startMin)}
              </div>
            )}
          </div>
          {/* 체크박스(§4.9): 24px 원, 히트영역 44×44(after -inset-2.5 = 24+2×10px, Apple HIG).
              즉시 커밋 — 명시적 저장 원칙의 유일한 예외. 에디터 안 열림(stopPropagation). */}
          <button
            type="button"
            data-no-dnd
            aria-label={STRINGS.card.completeLabel}
            aria-pressed={done}
            onClick={(e) => {
              e.stopPropagation();
              toggleComplete(id);
            }}
            className={`relative flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-(--blk-solid) transition-colors duration-(--duration-fast) after:absolute after:-inset-2.5 after:content-[''] ${
              done ? 'bg-(--blk-solid) text-text-on-solid' : 'text-transparent'
            }`}
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3.5"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
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
