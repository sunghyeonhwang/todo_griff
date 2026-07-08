// 큐레이션 이모지 24개 — DESIGN.md §5 필드 3, §9
// 이모지 라이브러리 금지(500KB+, PWA 프리캐시 파괴) — 이 목록이 전부다.
// EmojiGrid가 6×4로 렌더. 기본값은 '📌'(§2).

export const CURATED_EMOJIS = [
  '📌', '💼', '📝', '📚', '💻', '🎨',
  '🏃', '🏋️', '🧘', '🚶', '🍳', '🍽️',
  '☕', '🛒', '🧹', '🚿', '😴', '🌙',
  '💊', '📞', '🚗', '✈️', '🎮', '🎵',
] as const;

export const DEFAULT_EMOJI: string = CURATED_EMOJIS[0]; // '📌' — §2 TimeBlock.emoji 기본
