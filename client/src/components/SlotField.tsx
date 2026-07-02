import { useRef, useState } from 'react';
import { formatSlotInput, parseSlotText } from '../lib/timeText.ts';

interface Props {
  start: string | null;
  end: string | null;
  onCommit: (start: string | null, end: string | null) => void;
  ariaLabel: string;
  placeholder?: string;
}

// Champ créneau 24h à saisie souple : "9", "9h30", "930", "9-10h30" ; vide =
// non planifié. Commit au blur / Enter, valeur renormalisée en "HH:MM–HH:MM" ;
// bordure rouge si invalide (et Enter ne ferme pas l'éditeur parent).
export function SlotField({ start, end, onCommit, ariaLabel, placeholder = 'ex: 9-10h30' }: Props) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [invalid, setInvalid] = useState(false);

  function commit(): boolean {
    const el = ref.current;
    if (!el) return true;
    const slot = parseSlotText(el.value);
    if (!slot) {
      setInvalid(true);
      return false;
    }
    setInvalid(false);
    el.value = formatSlotInput(slot.start, slot.end);
    if (slot.start !== start || slot.end !== end) onCommit(slot.start, slot.end);
    return true;
  }

  return (
    <input
      ref={ref}
      type="text"
      className={`slot-field${invalid ? ' invalid' : ''}`}
      defaultValue={formatSlotInput(start, end)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      title="Créneau 24h — ex: 9-10h30, 14, 930 ; vide = sans horaire"
      onChange={() => setInvalid(false)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !commit()) e.stopPropagation();
      }}
    />
  );
}
