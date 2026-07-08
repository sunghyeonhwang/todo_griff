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
} as const;
