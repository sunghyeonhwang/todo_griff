import { useShallow } from 'zustand/react/shallow';
import ThemeToggle from './ThemeToggle';
import { useNow } from '../hooks/useNow';
import { STRINGS } from '../lib/strings';
import { dayOfMonth, formatHeaderDate, isTodayKey, weekDateKeys } from '../lib/time';
import { useUiStore } from '../store/uiStore';

const EVENING_MIN = 18 * 60; // 하루 돌아보기 진입점 강조 시작 시각(18:00, §16)

// 날짜 내비게이션 헤더 — DESIGN.md §6.5 (Structured 비주얼 정체성)
// - 스크롤러 밖 shrink-0 형제(App에서 Timeline 위) — sticky + backdrop-blur의 iOS 지터 회피.
// - 1행: ‹ › 화살표(goRelative ±1) · ko 날짜 라벨("7월 8일 수요일") · "오늘" · 테마 토글(§6.3).
// - 2행: 주간 스트립(월요일 시작 7칸) — Structured의 상징 요소. 요일 글자 + 날짜 원,
//   선택일 = accent 채움 + 흰 글자, 오늘(비선택) = accent 글자. 탭 = goToDate.
//   스트립은 activeDateKey가 속한 주를 파생 렌더 — ‹ ›로 주 경계를 넘으면 자동 리센터.
// - "오늘" = goToToday(날짜 변경) + onToday(App이 Timeline.scrollToNow('smooth')로 배선,
//   이미 오늘이어도 스크롤 실행 — §4.7).
// - 일정 추가는 플로팅 + 버튼(AddFab, §6.5)으로 이동 — 헤더에는 없음.

interface DateHeaderProps {
  /** "오늘" 탭 시 goToToday 직후 호출 — 스크롤-투-나우 smooth 트리거 */
  onToday: () => void;
}

export default function DateHeader({ onToday }: DateHeaderProps) {
  const { activeDateKey, goRelative, goToToday, goToDate, openReview } = useUiStore(
    useShallow((s) => ({
      activeDateKey: s.activeDateKey,
      goRelative: s.goRelative,
      goToToday: s.goToToday,
      goToDate: s.goToDate,
      openReview: s.openReview,
    })),
  );
  // 저녁(18시 이후) & 오늘일 때 진입점 강조 — 나우라인과 동일한 useNow 틱 재사용(§16)
  const { nowMin, todayKey } = useNow();
  const eveningNudge = activeDateKey === todayKey && nowMin >= EVENING_MIN;

  const handleToday = () => {
    goToToday();
    onToday();
  };

  const week = weekDateKeys(activeDateKey);

  return (
    <header className="z-(--z-header) shrink-0 border-b border-surface-timeline-line bg-surface-card pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-1 px-2 pt-2">
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
        {/* 하루 돌아보기(See §16) — 항상 접근 가능, 저녁엔 도트로 강조 */}
        <button
          type="button"
          aria-label={STRINGS.review.open}
          onClick={openReview}
          className="relative flex size-9 shrink-0 items-center justify-center rounded-full text-text-secondary active:bg-surface-background"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5"
          >
            <path d="M9 11l3 3 8-8" />
            <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
          </svg>
          {eveningNudge && (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 size-2 rounded-full bg-accent-primary"
            />
          )}
        </button>
        <ThemeToggle />
      </div>
      {/* 주간 스트립 — 7칸 균등, 요일 글자 + 날짜 원 */}
      <div className="flex px-2 pt-1 pb-2">
        {week.map((key, i) => {
          const selected = key === activeDateKey;
          const today = isTodayKey(key);
          return (
            <button
              key={key}
              type="button"
              aria-label={formatHeaderDate(key)}
              aria-current={selected ? 'date' : undefined}
              onClick={() => goToDate(key)}
              className="flex flex-1 flex-col items-center gap-1 py-0.5"
            >
              <span
                className={`text-xs ${selected ? 'font-semibold text-accent-primary' : 'text-text-tertiary'}`}
              >
                {STRINGS.weekdays[i]}
              </span>
              <span
                className={`flex size-8 items-center justify-center rounded-full text-sm tabular-nums transition-colors duration-(--duration-fast) ${
                  selected
                    ? 'bg-accent-primary font-semibold text-text-on-solid'
                    : today
                      ? 'font-semibold text-accent-primary'
                      : 'text-text-secondary'
                }`}
              >
                {dayOfMonth(key)}
              </span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
