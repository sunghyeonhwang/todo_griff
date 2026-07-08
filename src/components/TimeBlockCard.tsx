import { CAPTION_MIN_HEIGHT, RULER_WIDTH, formatMinutes, minutesToY } from '../lib/time';
import { STRINGS } from '../lib/strings';
import { useBlocksStore } from '../store/blocksStore';
import { useUiStore } from '../store/uiStore';

// 블록 카드 — DESIGN.md §4.8 (Stage 3: 정적 아나토미 + 탭 → 에디터)
// - 위치/높이 = minutesToY만(인라인 픽셀 계산 금지). 좌 인셋 거터(RULER_WIDTH) ~ 우측 8px,
//   풀폭 렌더 — 겹침 lane 분할은 Stage 6(lanes.ts).
// - 엔티티 구독: s.blocks[id] 참조 동일성 — 무관한 변경에 리렌더 없음(§3.3).
// - 카드는 포커스 가능한 role="button"(Enter/Space → 에디터, §4.8) — 내부에 체크박스가 있어
//   <button> 중첩을 피한다.
// - 체크박스는 마크업만(24px 원 + aria + data-no-dnd + stopPropagation) —
//   토글 배선·44px 히트영역·완료 비주얼은 Stage 6(§4.9), dnd-kit 장착(이동)은 Stage 5.
// - pointerdown stopPropagation: 빈 면 드래그 생성(§4.2)이 기존 블록 위에서 시작되지 않게
//   캔버스 핸들러 도달을 차단(Stage 4). dnd-kit 센서는 카드 자신에 붙으므로(Stage 5) 영향 없음.
//   + contextmenu preventDefault / touch-callout 차단(§4.5 하드닝 — 카드·면 공통).

export default function TimeBlockCard({ id }: { id: string }) {
  const block = useBlocksStore((s) => s.blocks[id]);
  const openEdit = useUiStore((s) => s.openEdit);
  if (!block) return null;

  const top = minutesToY(block.startMin);
  const height = minutesToY(block.endMin) - top;
  // 시간 캡션은 높이 ≥ 40px(25분)일 때만 — 15분 블록(24px)은 이모지+제목 한 줄(§4.8)
  const showCaption = height >= CAPTION_MIN_HEIGHT;

  const open = () => openEdit(id);

  return (
    <div
      role="button"
      tabIndex={0}
      data-color={block.color}
      onClick={open}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      className="absolute right-2 z-(--z-block) touch-pan-y overflow-hidden rounded-md bg-(--blk-bg) shadow-block outline-none select-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-accent-primary"
      style={{ top, height, left: RULER_WIDTH }}
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
          {formatMinutes(block.startMin)} – {formatMinutes(block.endMin)}
        </div>
      )}
    </div>
  );
}
