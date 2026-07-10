import { useRef } from 'react';
import AddFab from './components/AddFab';
import BlockEditor from './components/BlockEditor';
import DateHeader from './components/DateHeader';
import LoginScreen from './components/LoginScreen';
import OkrScreen from './components/OkrScreen';
import QueInbox from './components/QueInbox';
import TabBar from './components/TabBar';
import Timeline, { type TimelineHandle } from './components/Timeline';
import Toast from './components/Toast';
import { useAuthStore } from './store/authStore';
import { useUiStore } from './store/uiStore';

// 앱 셸 — DESIGN.md §6.5
// - 루트 h-dvh (100vh/h-screen 금지 — iOS 툴바 문제), max-w-app 중앙 컬럼.
// - 데스크톱: "폰 프레임"(측면 헤어라인 + shadow-lg) / 모바일: 엣지-투-엣지 (sm: 분기).
// - 하단 탭 2개(오늘 | 목표 §15)가 화면을 전환한다. '오늘' = DateHeader+인박스+Timeline+FAB,
//   '목표' = OkrScreen. 탭 바는 컬럼 하단 shrink-0 형제, 비활성 화면은 언마운트.
// - DateHeader는 스크롤러 밖의 shrink-0 형제, 스크롤 컨테이너는 Timeline이 소유(§4.1).
// - "오늘" 버튼 → Timeline.scrollToNow('smooth') 배선(§4.7) — 이미 오늘이어도 실행.
// - AddFab(플로팅 +)은 컬럼 relative 기준 우하단(§6.5, Structured 정체성) — 오늘 탭 전용.
// - BlockEditor(에디터 시트)·Toast(z-toast 60, 시트 위)는 앱 전체에 인스턴스 1개씩(§5, §9).
export default function App() {
  const timelineRef = useRef<TimelineHandle>(null);
  const activeTab = useUiStore((s) => s.activeTab);
  // Que 미연결(anon) + "나중에" 미선택이면 셸 대신 로그인 노출(§14.8). Toast는 병행 마운트
  // (부팅 시 safeStorage 손상 안내 등이 유실되지 않게).
  const showLogin = useAuthStore((s) => s.status === 'anon' && !s.dismissed);

  if (showLogin) {
    return (
      <>
        <LoginScreen />
        <Toast />
      </>
    );
  }

  return (
    <div className="h-dvh bg-surface-background">
      <div className="relative mx-auto flex h-full w-full max-w-app flex-col bg-surface-card sm:border-x sm:border-surface-timeline-line sm:shadow-lg">
        {activeTab === 'today' ? (
          <>
            <DateHeader onToday={() => timelineRef.current?.scrollToNow('smooth')} />
            <QueInbox />
            <Timeline ref={timelineRef} />
            <AddFab />
          </>
        ) : (
          <OkrScreen />
        )}
        <TabBar />
      </div>
      <BlockEditor />
      <Toast />
    </div>
  );
}
