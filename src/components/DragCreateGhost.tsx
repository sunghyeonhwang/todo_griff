import type { CreateDraftPreview } from '../hooks/useDragCreate';
import { RULER_WIDTH, formatMinutes, minutesToY } from '../lib/time';
import { DEFAULT_COLOR } from '../store/blocksStore';
import { useUiStore } from '../store/uiStore';

// 드래그 생성 고스트 — DESIGN.md §4.2
// - 렌더 소스 2단계: 드래그 중엔 훅 로컬 프리뷰(draft prop — 60fps 스토어 미경유 §3.2),
//   릴리즈 후 create 에디터 열림 중엔 editor.draft — 저장 전까지 위치를 계속 보여준다.
//   (스토어 쓰기는 저장 버튼의 addBlock 1회뿐 — 고스트는 순수 프리뷰, 취소 시 잔여물 제로)
// - 점선 테두리 --blk-border + 60% 채움 + 라이브 "HH:mm – HH:mm" 라벨. 새 블록 기본색 기준.
// - 위치/높이 = minutesToY만(§4.1), 좌우 인셋은 카드와 동일(거터 ~ 우측 8px §4.8).
// - pointer-events: none — 진행 중 제스처를 가로채지 않는다. z-block(카드와 동층, 빈 면 전용).

export default function DragCreateGhost({ draft }: { draft: CreateDraftPreview | null }) {
  const editor = useUiStore((s) => s.editor);
  const activeDateKey = useUiStore((s) => s.activeDateKey);

  const range =
    draft ??
    (editor.mode === 'create' && editor.draft.dateKey === activeDateKey ? editor.draft : null);
  if (!range) return null;

  const top = minutesToY(range.startMin);
  const height = minutesToY(range.endMin) - top;

  return (
    <div
      aria-hidden
      data-color={DEFAULT_COLOR}
      className="pointer-events-none absolute right-2 z-(--z-block) overflow-hidden rounded-md border-2 border-dashed border-(--blk-border) bg-(--blk-bg)/60"
      style={{ top, height, left: RULER_WIDTH }}
    >
      {/* 라이브 시간 라벨 — 카드 내용 행과 같은 24px 행(15분 고스트에서도 노출) */}
      <div className="flex h-6 items-center pl-3 text-xs font-semibold tabular-nums text-(--blk-fg)">
        {formatMinutes(range.startMin)} – {formatMinutes(range.endMin)}
      </div>
    </div>
  );
}
