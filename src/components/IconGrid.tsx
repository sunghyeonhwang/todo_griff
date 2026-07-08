import { CURATED_ICONS } from '../lib/icons';
import { STRINGS } from '../lib/strings';

// 큐레이션 아이콘 그리드 — DESIGN.md §5 필드 3
// 4×2 = 8개(lib/icons.ts 단일 소스). 외부 아이콘 팩 금지 — 번들된 8개 SVG만.
// value/onSelect는 아이콘 id(문자)로 오간다(이모지 문자 아님).

interface IconGridProps {
  value: string;
  onSelect: (id: string) => void;
}

export default function IconGrid({ value, onSelect }: IconGridProps) {
  return (
    <div role="listbox" aria-label={STRINGS.editor.iconGridLabel} className="grid grid-cols-4 gap-1">
      {CURATED_ICONS.map((icon) => (
        <button
          key={icon.id}
          type="button"
          role="option"
          aria-selected={icon.id === value}
          aria-label={icon.label}
          onClick={() => onSelect(icon.id)}
          className={`flex size-11 items-center justify-center rounded-md ${
            icon.id === value
              ? 'bg-surface-card ring-2 ring-accent-primary'
              : 'active:bg-surface-card'
          }`}
        >
          <img src={icon.src} alt="" className="size-7" />
        </button>
      ))}
    </div>
  );
}
