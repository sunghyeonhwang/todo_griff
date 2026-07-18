// ============================================================
// Structured Planner — Design Tokens (TypeScript)
// v1.0.0 — design_token/tokens.ts 사본 (DESIGN.md §6.1)
// 수정 1건: LAYOUT.hourHeight/pxPerMinute 64/1.0667 → 96/1.6 (§4.1)
// ============================================================

export const BLOCK_COLORS = {
  blue:   { bg: '#E8F0FE', fg: '#1A73E8', solid: '#4285F4', border: '#C6DAFC' },
  green:  { bg: '#E6F4EA', fg: '#1E8E3E', solid: '#34A853', border: '#C4E7CE' },
  orange: { bg: '#FEF0E3', fg: '#E8710A', solid: '#FA903E', border: '#FBDDC3' },
  red:    { bg: '#FCE8E6', fg: '#D93025', solid: '#EA4335', border: '#F7C6C2' },
  purple: { bg: '#F3E8FD', fg: '#8430CE', solid: '#A250E8', border: '#E3CBF9' },
  pink:   { bg: '#FCE4EC', fg: '#D01884', solid: '#EC4899', border: '#F8C6DD' },
  teal:   { bg: '#E0F7F5', fg: '#00897B', solid: '#14B8A6', border: '#B8ECE6' },
  gray:   { bg: '#F1F3F4', fg: '#5F6368', solid: '#9AA0A6', border: '#DADCE0' },
} as const;

export type BlockColor = keyof typeof BLOCK_COLORS;
export const BLOCK_COLOR_KEYS = Object.keys(BLOCK_COLORS) as BlockColor[];

export const LAYOUT = {
  appMaxWidth:       480,
  // ⚠ 토큰 원본(64)에서 의도적 상향 — DESIGN.md §4.1:
  // 원본 pxPerMinute 1.0667은 비정수라 5분 스냅이 5.33px(서브픽셀 드리프트),
  // 15분 최소 블록이 16px로 제목 렌더 불가(blockMinHeight 24px와 모순).
  // 96px/시 = 5분 8px 정수, 15분 블록 24px = blockMinHeight와 정확히 일치.
  hourHeight:        96,
  pxPerMinute:       96 / 60, // 1.6
  timeLabelWidth:    60,
  // 제스처 스냅 15→10 (DESIGN.md §4.1 개정): 96px/시에서 10분 = 16px 정수라 서브픽셀 없음.
  // lib/time.ts GESTURE_SNAP·styles/tokens.css --snap-minutes와 동기.
  snapMinutes:       10,
  // 렌더 최소 높이(24px = 15분). 이제 '창작 최소 블록 길이'(MIN_DURATION=20분=32px)와 분리된
  // '카드 렌더 하한'을 의미한다 — 레거시 15분 블록을 강제 변환하지 않고 가독성만 보장(§4.1 개정).
  blockMinHeight:    24,
  nowIndicatorWidth: 2,
} as const;

export const MOTION = {
  duration: { fast: 120, base: 200, slow: 320 },
  easing: {
    standard:   'cubic-bezier(0.4, 0.0, 0.2, 1)',
    decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
    spring:     'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

export const Z_INDEX = {
  base: 0, block: 10, now: 20, dragging: 30, header: 40, modal: 50, toast: 60,
} as const;

export const RADIUS = {
  none: 0, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 28, full: 9999,
} as const;

export const SPACING = {
  0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64,
} as const;
