// 한국어 UI 카피 단일 모듈 — DESIGN.md §1, §9
// 컴포넌트/훅에 한국어 문자열 하드코딩 금지. 새 카피는 반드시 여기에 추가한다.

export const STRINGS = {
  appName: 'DayBlocks',
  /** PWA manifest description(§8) — vite.config.ts가 import(카피 단일 소스 유지) */
  appDescription: '하루를 세로 타임라인으로 계획하는 데일리 플래너',

  header: {
    prevDay: '이전 날짜',
    nextDay: '다음 날짜',
    today: '오늘',
    addBlock: '새 일정 추가',
  },

  editor: {
    createTitle: '새 일정',
    editTitle: '일정 편집',
    defaultTitle: '새 일정',        // 빈 제목 저장 시 대체(§2 — 저장 비활성화 없음)
    cancel: '취소',
    save: '저장',
    titlePlaceholder: '제목',
    iconButtonLabel: '아이콘·색상 선택',
    iconGridLabel: '아이콘',
    colorPickerLabel: '색상',
    startLabel: '시작',
    endLabel: '종료',
    timeOrderHint: '종료 시각은 시작 시각보다 늦어야 해요',
    alarmLabel: '알림',
    alarmCaveat: '알림은 앱이 열려 있는 동안에만 동작합니다',
    // 시작 전 오프셋(§2 AlarmOffset)과 1:1
    alarmOffsets: {
      0: '시작 시각에',
      5: '5분 전',
      10: '10분 전',
      15: '15분 전',
      30: '30분 전',
      60: '1시간 전',
    },
    // iOS Safari 비-standalone 힌트(§5) + 저장소 파티션 사실 한 줄(§8)
    installHint:
      "홈 화면에 추가하면 알림을 받을 수 있어요 — Safari 공유 → '홈 화면에 추가' (탭과 설치된 앱의 데이터는 분리 저장돼요)",
    dismissHint: '힌트 닫기',
    projectSection: '프로젝트',
    projectPlaceholder: '프로젝트 이름 (선택)',
    notePlaceholder: '메모',
    delete: '삭제',
    deleteConfirm: '한 번 더 탭하면 삭제',
    close: '닫기',
    timeSection: '시간',
    durationSection: '소요시간',
    /** 컬러 밴드 시간 요약 — 예: '10:00 ~ 10:15 (15분)' (§5) */
    timeSummary: (start: string, end: string, duration: string) =>
      `${start} ~ ${end} (${duration})`,
  },

  card: {
    completeLabel: '완료 표시',
  },

  /** 블록 아이콘 한글 라벨 — lib/icons.ts CURATED_ICONS id와 1:1(§5 필드 3). 피커 aria-label. */
  icons: {
    star: '중요',
    calendar: '일정',
    dialog: '대화',
    notification: '알림',
    paperplane: '발송',
    camera: '사진',
    design: '디자인',
    compass: '탐색',
  },

  timeline: {
    emptyDay: '계획이 없어요 ✨',   // 빈 날 힌트(§6.5) — 09:00–11:00 밴드
  },

  alarm: {
    /** OS 알림·인앱 토스트 본문 — 예: '09:00 시작' (§7) */
    startsAt: (time: string) => `${time} 시작`,
  },

  /** 주간 스트립 요일 글자 — 월요일 시작(time.ts weekDateKeys와 순서 일치, §6.5) */
  weekdays: ['월', '화', '수', '목', '금', '토', '일'],

  /** 소요시간 라벨 — 예: '1시간 45분' / '45분' / '2시간' (§4.8 카드 캡션) */
  duration: (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m}분`;
    if (m === 0) return `${h}시간`;
    return `${h}시간 ${m}분`;
  },

  colors: {
    blue: '파랑',
    green: '초록',
    orange: '주황',
    red: '빨강',
    purple: '보라',
    pink: '분홍',
    teal: '청록',
    gray: '회색',
  },

  storage: {
    corruptBackup: '저장 데이터를 읽지 못해 백업 후 초기화했어요',
    quotaExceeded: '저장 공간이 부족해 변경사항을 저장하지 못했어요',
  },

  // Que 연동 카피 — DESIGN.md §14.8 (컴포넌트 하드코딩 금지, 규칙5)
  que: {
    login: {
      title: 'QUE 연결',
      subtitle: 'QUE 작업을 타임라인에 연결하기',
      google: 'Log in with Google',
      googleSoon: 'Google 로그인은 준비 중이에요', // 구글 auth 미구현 — 버튼만 노출(비작동)
      or: 'or',
      emailPlaceholder: 'Email',
      passwordPlaceholder: 'Password',
      submit: '로그인',
      submitting: '연결 중…',
      later: '나중에',
      genericError: '이메일 또는 비밀번호를 확인해 주세요',
    },
    inbox: {
      title: 'Que 할 일',
      count: (n: number) => `Que 할 일 ${n}`,
      empty: '배치할 Que 할 일이 없어요',
      place: '오늘에 배치',
      connect: 'Que 계정 연결',
      refresh: '새로고침',
      logout: '로그아웃',
      noProject: '프로젝트 없음',
    },
    sync: {
      syncing: '동기화 중…',
      synced: '동기화됨',
      pending: (n: number) => `대기 ${n}`,
      error: '동기화 실패',
    },
    error: {
      offline: '네트워크에 연결할 수 없어요',
      generic: '요청을 처리하지 못했어요',
      notConnected: 'Que 계정이 연결되어 있지 않아요',
    },
    toast: {
      connected: (name: string) => `${name}님, Que에 연결됐어요`,
      disconnected: 'Que에서 로그아웃했어요',
      sessionExpired: 'Que 세션이 만료됐어요. 다시 연결해 주세요',
      syncFailed: 'Que 동기화에 실패한 항목이 있어요',
      placed: 'Que 할 일을 타임라인에 배치했어요',
    },
  },
} as const;
