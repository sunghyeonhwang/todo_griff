// 한국어 UI 카피 단일 모듈 — DESIGN.md §1, §9
// 컴포넌트/훅에 한국어 문자열 하드코딩 금지. 새 카피는 반드시 여기에 추가한다.

export const STRINGS = {
  appName: 'DayBlocks',

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
    emojiButtonLabel: '이모지·색상 선택',
    emojiGridLabel: '이모지',
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
    notePlaceholder: '메모',
    delete: '삭제',
    deleteConfirm: '한 번 더 탭하면 삭제',
  },

  card: {
    completeLabel: '완료 표시',
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
} as const;
