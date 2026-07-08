import { useRef } from 'react';
import BlockEditor from './components/BlockEditor';
import DateHeader from './components/DateHeader';
import Timeline, { type TimelineHandle } from './components/Timeline';

// 앱 셸 — DESIGN.md §6.5
// - 루트 h-dvh (100vh/h-screen 금지 — iOS 툴바 문제), max-w-app 중앙 컬럼.
// - 데스크톱: "폰 프레임"(측면 헤어라인 + shadow-lg) / 모바일: 엣지-투-엣지 (sm: 분기).
// - DateHeader는 스크롤러 밖의 shrink-0 형제, 스크롤 컨테이너는 Timeline이 소유(§4.1).
// - "오늘" 버튼 → Timeline.scrollToNow('smooth') 배선(§4.7) — 이미 오늘이어도 실행.
// - BlockEditor(에디터 시트)는 앱 전체에 인스턴스 1개(§5). Toast는 Stage 6(§10).
export default function App() {
  const timelineRef = useRef<TimelineHandle>(null);

  return (
    <div className="h-dvh bg-surface-background">
      <div className="mx-auto flex h-full w-full max-w-app flex-col bg-surface-card sm:border-x sm:border-surface-timeline-line sm:shadow-lg">
        <DateHeader onToday={() => timelineRef.current?.scrollToNow('smooth')} />
        <Timeline ref={timelineRef} />
      </div>
      <BlockEditor />
    </div>
  );
}
