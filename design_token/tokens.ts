// ============================================================
// Structured Planner — Design Tokens (TypeScript)
// v1.0.0 — 컴포넌트/스토어 로직에서 타입 안전하게 참조
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
  hourHeight:        64,
  pxPerMinute:       64 / 60, // 1.0667
  timeLabelWidth:    60,
  snapMinutes:       15,
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
