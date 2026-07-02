// Saisie d'heures en 24h, syntaxe souple, zéro dépendance.
// Remplace les <input type="time"> natifs (affichage AM/PM selon la locale).

export interface SlotValue {
  start: string | null;
  end: string | null;
}

// Une heure 24h en syntaxe souple -> "HH:MM" normalisé, ou null si invalide.
// Accepte : "9", "09", "9h", "9H", "9h30", "9:30", "9.30", "930", "1430".
export function parseTimeToken(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (s === '') return null;

  let h: number;
  let m: number;
  let match = /^(\d{1,2})\s*[h:.]\s*(\d{2})$/.exec(s);
  if (match) {
    h = Number(match[1]);
    m = Number(match[2]);
  } else if ((match = /^(\d{1,2})\s*h?$/.exec(s))) {
    h = Number(match[1]);
    m = 0;
  } else if ((match = /^(\d{3,4})$/.exec(s))) {
    const v = match[1] as string;
    h = Number(v.slice(0, v.length - 2));
    m = Number(v.slice(-2));
  } else {
    return null;
  }

  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Un créneau en syntaxe souple -> { start, end }, ou null si invalide (y
// compris fin < début). Vide = non planifié. Accepte : "9-10h30", "9 - 10:30",
// "9->10", "9" (début seul), "-10h" (fin seule), "".
export function parseSlotText(raw: string): SlotValue | null {
  const s = raw.trim();
  if (s === '' || s === '—') return { start: null, end: null };

  // Fin seule : "-10h30" / "–10h30".
  const endOnly = /^(?:->|[-–—>])\s*(.+)$/.exec(s);
  if (endOnly && endOnly[1]) {
    const end = parseTimeToken(endOnly[1]);
    return end ? { start: null, end } : null;
  }

  const parts = s.split(/\s*(?:->|[-–—>])\s*/).filter((p) => p !== '');
  if (parts.length === 1 && parts[0]) {
    const start = parseTimeToken(parts[0]);
    return start ? { start, end: null } : null;
  }
  if (parts.length === 2 && parts[0] && parts[1]) {
    const start = parseTimeToken(parts[0]);
    const end = parseTimeToken(parts[1]);
    if (!start || !end || end < start) return null;
    return { start, end };
  }
  return null;
}

// Affichage normalisé d'un créneau dans un champ de saisie.
export function formatSlotInput(start: string | null, end: string | null): string {
  if (start && end) return `${start}–${end}`;
  if (start) return start;
  if (end) return `–${end}`;
  return '';
}

// Extrait un créneau en tête d'un texte de création rapide :
// "9-10h30 Réviser" -> { start, end, text: "Réviser" }.
// Un nombre nu n'est PAS traité comme heure ("9 pompes" reste un intitulé) :
// il faut un marqueur explicite (h, :, ., -, >) ou 3-4 chiffres ("930").
export function extractLeadingSlot(raw: string): { start: string | null; end: string | null; text: string } {
  const m = /^\s*(\S+)\s+(\S[\s\S]*)$/.exec(raw);
  if (m && m[1] && m[2]) {
    const token = m[1];
    const looksLikeTime = /[h:.\-–—>]/i.test(token) || /^\d{3,4}$/.test(token);
    if (looksLikeTime) {
      const slot = parseSlotText(token);
      if (slot && (slot.start !== null || slot.end !== null)) {
        return { start: slot.start, end: slot.end, text: m[2].trim() };
      }
    }
  }
  return { start: null, end: null, text: raw.trim() };
}
