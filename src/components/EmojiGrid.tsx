import { CURATED_EMOJIS } from '../lib/emojis';
import { STRINGS } from '../lib/strings';

// 큐레이션 이모지 그리드 — DESIGN.md §5 필드 3
// 6×4 = 24개(lib/emojis.ts 단일 소스). 이모지 라이브러리 금지(500KB+, PWA 프리캐시 파괴).

interface EmojiGridProps {
  value: string;
  onSelect: (emoji: string) => void;
}

export default function EmojiGrid({ value, onSelect }: EmojiGridProps) {
  return (
    <div role="listbox" aria-label={STRINGS.editor.emojiGridLabel} className="grid grid-cols-6 gap-1">
      {CURATED_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          role="option"
          aria-selected={emoji === value}
          onClick={() => onSelect(emoji)}
          className={`flex size-9 items-center justify-center rounded-sm text-lg ${
            emoji === value
              ? 'bg-surface-card ring-2 ring-accent-primary'
              : 'active:bg-surface-card'
          }`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
