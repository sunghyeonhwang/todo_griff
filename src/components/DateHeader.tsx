import { useShallow } from 'zustand/react/shallow';
import { STRINGS } from '../lib/strings';
import { DAY_MINUTES, DEFAULT_DURATION, formatHeaderDate, nowMinutes } from '../lib/time';
import { useUiStore } from '../store/uiStore';

// 날짜 내비게이션 헤더 — DESIGN.md §9, §6.5
// - 스크롤러 밖 shrink-0 형제(App에서 Timeline 위) — sticky + backdrop-blur의 iOS 지터 회피.
// - ‹ › 화살표(goRelative ±1) · ko 날짜 라벨("7월 8일 수요일") · "오늘" · "+" 버튼.
// - "오늘" = goToToday(날짜 변경) + onToday(App이 Timeline.scrollToNow('smooth')로 배선,
//   이미 오늘이어도 스크롤 실행 — §4.7).
// - "+" = 활성 날짜에 create 드래프트로 에디터 오픈(§5):
//   start = min(다음 정시, 1380=23:00), end = min(start+60, 1440). 스토어 쓰기는 저장 시 1회.

interface DateHeaderProps {
  /** "오늘" 탭 시 goToToday 직후 호출 — 스크롤-투-나우 smooth 트리거 */
  onToday: () => void;
}

export default function DateHeader({ onToday }: DateHeaderProps) {
  const { activeDateKey, goRelative, goToToday, openCreate } = useUiStore(
    useShallow((s) => ({
      activeDateKey: s.activeDateKey,
      goRelative: s.goRelative,
      goToToday: s.goToToday,
      openCreate: s.openCreate,
    })),
  );

  const handleToday = () => {
    goToToday();
    onToday();
  };

  // "+" 드래프트(§5): 다음 정시(지금이 정시면 그 시각), 23:00 상한 · 60분 길이 · 24:00 클램프
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
    <header className="z-(--z-header) shrink-0 border-b border-surface-timeline-line bg-surface-card pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-1 px-2 py-2">
        <button
          type="button"
          aria-label={STRINGS.header.prevDay}
          onClick={() => goRelative(-1)}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-lg text-text-secondary active:bg-surface-background"
        >
          ‹
        </button>
        <h1 className="min-w-0 truncate px-1 text-md font-semibold text-text-primary">
          {formatHeaderDate(activeDateKey)}
        </h1>
        <button
          type="button"
          aria-label={STRINGS.header.nextDay}
          onClick={() => goRelative(1)}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-lg text-text-secondary active:bg-surface-background"
        >
          ›
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleToday}
          className="h-9 shrink-0 rounded-full px-3 text-sm font-medium text-accent-primary active:bg-surface-background"
        >
          {STRINGS.header.today}
        </button>
        <button
          type="button"
          aria-label={STRINGS.header.addBlock}
          onClick={handleAdd}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-xl text-accent-primary active:bg-surface-background"
        >
          +
        </button>
      </div>
    </header>
  );
}
