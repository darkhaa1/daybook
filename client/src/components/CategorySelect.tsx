import { CATEGORIES, CATEGORY_LABELS } from '@shared';
import type { Category } from '../types.ts';

interface Props {
  value: Category;
  onChange: (value: Category) => void;
  id?: string;
  ariaLabel?: string;
}

export function CategorySelect({ value, onChange, id, ariaLabel }: Props) {
  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value as Category)}
    >
      {CATEGORIES.map((cat) => (
        <option key={cat} value={cat}>
          {cat} — {CATEGORY_LABELS[cat]}
        </option>
      ))}
    </select>
  );
}
