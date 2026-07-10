import type { AppTab } from '../types';
import { STRINGS } from '../lib/strings';
import { useUiStore } from '../store/uiStore';

// 하단 탭 바 — DESIGN.md §6.5 (오늘=타임라인 | 목표=OKR §15)
// 앱이 2-뷰가 되면서 신설된 유일한 전역 내비게이션. 셸 컬럼 하단 shrink-0 형제로,
// safe-area-inset-bottom을 흡수한다. 활성 탭 = accent-primary, 터치 대상 44px 이상.

const TABS: { tab: AppTab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  {
    tab: 'today',
    label: STRINGS.tabs.today,
    icon: () => (
      // 달력
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        className="size-6"
      >
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M3 9h18M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    tab: 'okr',
    label: STRINGS.tabs.okr,
    icon: () => (
      // 과녁
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        className="size-6"
      >
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

export default function TabBar() {
  const activeTab = useUiStore((s) => s.activeTab);
  const setTab = useUiStore((s) => s.setTab);

  return (
    <nav
      aria-label={STRINGS.tabs.navLabel}
      className="flex shrink-0 border-t border-surface-timeline-line bg-surface-card pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map(({ tab, label, icon }) => {
        const active = activeTab === tab;
        return (
          <button
            key={tab}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => setTab(tab)}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 pb-1 transition-colors duration-(--duration-fast) ${
              active ? 'text-accent-primary' : 'text-text-tertiary active:text-text-secondary'
            }`}
          >
            {icon(active)}
            <span className={`text-[11px] ${active ? 'font-semibold' : 'font-medium'}`}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
