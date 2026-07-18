import { useEffect, useRef, useState } from 'react';
import AddFab from './components/AddFab';
import BlockEditor from './components/BlockEditor';
import DateHeader from './components/DateHeader';
import DayReviewSheet from './components/DayReviewSheet';
import LoginScreen from './components/LoginScreen';
import OkrScreen from './components/OkrScreen';
import QueInbox from './components/QueInbox';
import TabBar from './components/TabBar';
import Timeline, { type TimelineHandle } from './components/Timeline';
import Toast from './components/Toast';
import { useDaySnapshot } from './hooks/useDaySnapshot';
import { STRINGS } from './lib/strings';
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
  const activeDateKey = useUiStore((s) => s.activeDateKey);
  // 하루 계획 스냅샷 캡처(§16) — 그날 첫 조회 시점에 오늘 계획을 저장(See 카드 비교 소스).
  useDaySnapshot();
  // Que 미연결(anon) + "나중에" 미선택이면 셸 대신 로그인 노출(§14.8). Toast는 병행 마운트
  // (부팅 시 safeStorage 손상 안내 등이 유실되지 않게).
  const showLogin = useAuthStore((s) => s.status === 'anon' && !s.dismissed);

  // 부팅 silent SSO(§14.8 확장): 로그인 화면을 그릴 상황이면 que.griff.co.kr 세션으로 1회 자동
  // 연결을 시도한다(스토어 ssoAttempted 가드가 중복 방지). 시도가 끝나기 전까지는 로그인 폼 대신
  // 최소 게이트를 보여 성공 시의 폼 깜빡임을 막는다. 실패/미로그인이면 게이트를 닫고 로그인 화면으로.
  // dismissed(나중에/로그아웃) 사용자는 자동 시도하지 않고 수동 버튼으로만 재연결한다.
  const [ssoBooting, setSsoBooting] = useState(() => {
    const s = useAuthStore.getState();
    return s.status === 'anon' && !s.dismissed && !s.ssoAttempted;
  });
  useEffect(() => {
    if (!ssoBooting) return;
    void useAuthStore
      .getState()
      .trySso()
      .finally(() => setSsoBooting(false));
  }, [ssoBooting]);

  if (ssoBooting && showLogin) {
    return (
      <>
        <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-[#1a1c1e]">
          <span
            aria-hidden
            className="size-6 animate-spin rounded-full border-2 border-white/25 border-t-white"
          />
          <p className="text-sm font-medium text-white/70">{STRINGS.que.sso.connecting}</p>
        </div>
        <Toast />
      </>
    );
  }

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
      {/* 하루 돌아보기(See §16) — 활성 날짜의 계획 스냅샷 vs 실행 비교. 앱 전체 인스턴스 1개. */}
      <DayReviewSheet dateKey={activeDateKey} />
      <Toast />
    </div>
  );
}
