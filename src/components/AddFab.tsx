import { STRINGS } from '../lib/strings';
import { DAY_MINUTES, DEFAULT_DURATION, nowMinutes } from '../lib/time';
import { useUiStore } from '../store/uiStore';

// 플로팅 일정 추가 버튼 — DESIGN.md §6.5 (Structured 비주얼 정체성)
// - 컬럼(relative) 우하단 고정, 56px 원형, accent 채움 + 흰 +, safe-area 보정.
//   bottom 76px = 하단 탭 바 높이(56px §6.5) + 20px 여백 — 탭 바와 겹치지 않게.
// - z-header(40): 시트 백드롭(z-modal 50)이 열리면 자연히 덮인다. Toast(60)보다 아래.
// - 드래프트(§5): start = min(다음 정시, 1380=23:00), end = min(start+60, 1440).
//   스토어 쓰기는 저장 시 addBlock 1회 — 여기서는 openCreate만.
export default function AddFab() {
  const activeDateKey = useUiStore((s) => s.activeDateKey);
  const openCreate = useUiStore((s) => s.openCreate);

  const handleAdd = () => {
    const startMin = Math.min(
      Math.ceil(nowMinutes() / 60) * 60,
      DAY_MINUTES - DEFAULT_DURATION,
    );
    openCreate({
      dateKey: activeDateKey,
      startMin,
      endMin: Math.min(startMin + DEFAULT_DURATION, DAY_MINUTES),
    });
  };

  return (
    <button
      type="button"
      aria-label={STRINGS.header.addBlock}
      onClick={handleAdd}
      className="absolute right-4 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-(--z-header) flex size-14 items-center justify-center rounded-full bg-accent-primary text-text-on-solid shadow-lg transition-transform duration-(--duration-fast) active:scale-95"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        className="size-7"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}
