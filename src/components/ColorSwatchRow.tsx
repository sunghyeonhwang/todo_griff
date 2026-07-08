import { STRINGS } from '../lib/strings';
import { BLOCK_COLOR_KEYS } from '../lib/tokens';
import type { BlockColor } from '../types';

// 색상 스와치 — DESIGN.md §5 필드 3, §6.2
// 8색 4×2, 28px 원. 채움은 data-color 브리지의 --blk-solid만(hex 금지), 선택 시 2px 링.

interface ColorSwatchRowProps {
  value: BlockColor;
  onSelect: (color: BlockColor) => void;
}

export default function ColorSwatchRow({ value, onSelect }: ColorSwatchRowProps) {
  return (
    <div role="radiogroup" aria-label={STRINGS.editor.colorPickerLabel} className="grid grid-cols-4 gap-2">
      {BLOCK_COLOR_KEYS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={color === value}
          aria-label={STRINGS.colors[color]}
          data-color={color}
          onClick={() => onSelect(color)}
          className={`size-7 rounded-full bg-(--blk-solid) ${
            color === value ? 'ring-2 ring-(--blk-solid) ring-offset-2 ring-offset-surface-background' : ''
          }`}
        />
      ))}
    </div>
  );
}
