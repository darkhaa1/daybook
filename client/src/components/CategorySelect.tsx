import { useCategories } from '../context/CategoriesContext.tsx';

interface Props {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  ariaLabel?: string;
  // Ajoute une première option "vide" (ex. buts sans catégorie) ; sinon le
  // select est désactivé lorsqu'aucune catégorie active n'existe.
  includeEmpty?: { label: string };
}

export function CategorySelect({ value, onChange, id, ariaLabel, includeEmpty }: Props) {
  const { active } = useCategories();
  const disabled = !includeEmpty && active.length === 0;

  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {includeEmpty && <option value="">{includeEmpty.label}</option>}
      {!includeEmpty && active.length === 0 && <option value="">Aucune catégorie active</option>}
      {active.map((cat) => (
        <option key={cat.key} value={cat.key}>
          {cat.key} — {cat.label}
        </option>
      ))}
    </select>
  );
}
