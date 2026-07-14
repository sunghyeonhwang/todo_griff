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
    themeToDark: '다크 모드로 전환',   // 현재 라이트 → 탭하면 다크
    themeToLight: '라이트 모드로 전환', // 현재 다크 → 탭하면 라이트
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

  /** 하단 탭 라벨(§6.5) */
  tabs: {
    navLabel: '주 화면',
    today: '오늘',
    okr: '목표',
  },

  // OKR — DESIGN.md §15 (컴포넌트 하드코딩 금지, 규칙5)
  okr: {
    prevQuarter: '이전 분기',
    nextQuarter: '다음 분기',
    addObjective: '목표 추가',
    addKeyResult: '핵심 결과 추가',
    defaultObjectiveTitle: '새 목표',
    defaultKrTitle: '새 핵심 결과',
    editObjective: '목표 편집',
    editKr: '핵심 결과 편집',
    objectiveTitleLabel: '목표 (이번 분기에 이루고 싶은 방향)',
    objectiveTitlePlaceholder: '예: 신규 매출 확대',
    krTitleLabel: '핵심 결과 (숫자로 잴 수 있는 것)',
    krTitlePlaceholder: '예: 신규 계약',
    krTargetLabel: '목표 수치',
    krCurrentLabel: '현재 수치',
    krUnitLabel: '단위',
    krUnitPlaceholder: '건 / % / 시간',
    krTargetHint: '목표 수치는 0보다 커야 해요',
    increment: '진척 +1',
    decrement: '진척 -1',
    progressLabel: (pct: number) => `진행률 ${pct}%`,
    delete: '삭제',
    deleteConfirm: '한 번 더 탭하면 삭제',
    save: '저장',
    // 교육형 빈 상태(첫 사용 가이드 — 로드맵 E-F 요건): 왜 → 무엇 → 어떻게 → 예시
    emptyTitle: '아직 등록된 목표가 없어요',
    emptyWhy:
      'OKR은 분기 동안 무엇을 이루고 싶은지(목표)와 그것을 숫자로 어떻게 잴지(핵심 결과)를 적어두는 방법이에요. 바쁜 하루 속에서도 방향을 잃지 않게 도와줍니다.',
    emptyWhat:
      '목표(O)는 방향을 담은 한 문장, 핵심 결과(KR)는 그 목표가 이뤄지고 있는지 재는 숫자예요.',
    emptyHow:
      "아래 '목표 추가'를 눌러 이번 분기 목표를 적고, 목표마다 핵심 결과를 1~3개 달아 보세요. 진척이 생길 때마다 + 버튼으로 숫자를 올리면 진행률이 채워집니다.",
    emptyExample: '예시: 목표 "신규 매출 확대" · 핵심 결과 "신규 계약 6건" · "리드 40건"',
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
    sso: {
      button: 'Que 세션으로 연결', // que.griff.co.kr 로그인 세션으로 자동 연결(수동 트리거)
      connecting: '세션 확인 중…', // 부팅 silent SSO 진행 게이트 + 버튼 진행 상태
      notFound: 'Que 세션을 찾지 못했어요. 로그인해 주세요', // 수동 SSO 실패 시에만 안내(silent 부팅은 무음)
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
      /** 원격 소실(삭제·취소·재배정) → 연동 해제·로컬 보존 안내(§14.7). */
      unlinked: (n: number) =>
        `Que에서 사라진 할 일 ${n}개를 로컬 일정으로 남겨뒀어요`,
      placed: 'Que 할 일을 타임라인에 배치했어요',
    },
  },
} as const;
