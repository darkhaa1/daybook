import { WEEKDAY_LABELS } from '../lib/date.ts';

interface Props {
  // null = "Tous les jours" ; 0=lundi..6=dimanche.
  value: number | null;
  onChange: (value: number | null) => void;
  id?: string;
  ariaLabel?: string;
}

// Sélecteur de récurrence d'un bloc de planning type : tous les jours ou un
// jour précis de la semaine.
export function DayOfWeekSelect({ value, onChange, id, ariaLabel }: Props) {
  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={value === null ? '' : String(value)}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    >
      <option value="">Tous les jours</option>
      {WEEKDAY_LABELS.map((label, i) => (
        <option key={label} value={i}>
          {label}
        </option>
      ))}
    </select>
  );
}
