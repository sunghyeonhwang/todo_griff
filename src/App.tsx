import { STRINGS } from './lib/strings';

// 앱 셸 — DESIGN.md §6.5
// - 루트 h-dvh (100vh/h-screen 금지 — iOS 툴바 문제), max-w-app 중앙 컬럼.
// - 데스크톱: "폰 프레임"(측면 헤어라인 + shadow-lg) / 모바일: 엣지-투-엣지 (sm: 분기).
// - 헤더는 스크롤러 밖의 shrink-0 형제 (sticky + backdrop-blur의 iOS 모멘텀 지터 회피).
// - Stage 2에서 헤더 자리표시자 → DateHeader, 스크롤러 내용 → Timeline으로 교체.
export default function App() {
  return (
    <div className="h-dvh bg-surface-background">
      <div className="mx-auto flex h-full w-full max-w-app flex-col bg-surface-card sm:border-x sm:border-surface-timeline-line sm:shadow-lg">
        <header className="z-(--z-header) shrink-0 border-b border-surface-timeline-line bg-surface-card pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-md font-semibold text-text-primary">{STRINGS.appName}</h1>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {/* Stage 2: Timeline (TimelineGrid + NowLine) */}
        </main>
      </div>
    </div>
  );
}
