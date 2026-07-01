import { useEffect, useMemo, useRef, useState } from 'react';
import type { FocusSession } from '../types.ts';
import { CategorySelect } from './CategorySelect.tsx';
import { useCategories } from '../context/CategoriesContext.tsx';

const WORK = 25 * 60;
const BREAK = 5 * 60;
const CIRC = 515.2; // 2πr, r = 82 (identique à la maquette)

type Mode = 'focus' | 'break';

interface Props {
  sessions: FocusSession[];
  onSessionComplete: (category: string, durationSec: number) => void;
}

function fmt(total: number): string {
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function Timer({ sessions, onSessionComplete }: Props) {
  const { active, all, colorOf } = useCategories();
  const [category, setCategory] = useState('');
  const [mode, setMode] = useState<Mode>('focus');
  const [remaining, setRemaining] = useState(WORK);
  const [running, setRunning] = useState(false);

  // Sélectionne la première catégorie active dès qu'elle est disponible.
  useEffect(() => {
    if (!category && active.length > 0) {
      const first = active[0];
      if (first) setCategory(first.key);
    }
  }, [active, category]);

  // Refs pour lire les valeurs courantes dans le callback d'intervalle.
  const modeRef = useRef(mode);
  const categoryRef = useRef(category);
  modeRef.current = mode;
  categoryRef.current = category;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev > 1) return prev - 1;
        // Fin de la phase courante.
        if (modeRef.current === 'focus') {
          onSessionComplete(categoryRef.current, WORK);
          setMode('break');
          setRunning(false);
          return BREAK;
        }
        setMode('focus');
        setRunning(false);
        return WORK;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, onSessionComplete]);

  function toggle() {
    setRunning((r) => !r);
  }

  function reset() {
    setRunning(false);
    setMode('focus');
    setRemaining(WORK);
  }

  const total = mode === 'focus' ? WORK : BREAK;
  const frac = remaining / total;
  const dashoffset = CIRC * (1 - frac);

  // Compte des sessions focus du jour par catégorie (données réelles).
  const tally = new Map<string, number>();
  for (const s of sessions) {
    tally.set(s.category, (tally.get(s.category) ?? 0) + 1);
  }

  // Catégories actives + toute catégorie ayant une session aujourd'hui (même archivée depuis).
  const tallyKeys = useMemo(() => {
    const activeKeys = active.map((c) => c.key);
    const sessionKeys = sessions.map((s) => s.category);
    const merged = Array.from(new Set([...activeKeys, ...sessionKeys]));
    const orderOf = new Map(all.map((c, i) => [c.key, i]));
    return merged.sort((a, b) => (orderOf.get(a) ?? 999) - (orderOf.get(b) ?? 999));
  }, [active, all, sessions]);

  return (
    <section className="panel timer-wrap">
      <p className="panel-title" style={{ width: '100%' }}>
        B — Focus
      </p>

      <div className="dial-container">
        <svg viewBox="0 0 200 200" width="190" height="190" aria-hidden="true">
          <circle cx="100" cy="100" r="82" fill="none" stroke="var(--line)" strokeWidth="6" />
          <circle
            id="arc"
            cx="100"
            cy="100"
            r="82"
            fill="none"
            stroke={mode === 'focus' ? 'var(--amber)' : 'var(--muted)'}
            strokeWidth="6"
            strokeDasharray={CIRC}
            strokeDashoffset={dashoffset}
            strokeLinecap="round"
            transform="rotate(-90 100 100)"
          />
          <g stroke="var(--muted)" strokeWidth="2">
            <line x1="100" y1="22" x2="100" y2="12" />
            <line x1="139" y1="32.5" x2="144" y2="23.8" />
            <line x1="167.5" y1="61" x2="176.2" y2="56" />
            <line x1="178" y1="100" x2="188" y2="100" />
            <line x1="167.5" y1="139" x2="176.2" y2="144" />
            <line x1="139" y1="167.5" x2="144" y2="176.2" />
            <line x1="100" y1="178" x2="100" y2="188" />
            <line x1="61" y1="167.5" x2="56" y2="176.2" />
            <line x1="32.5" y1="139" x2="23.8" y2="144" />
            <line x1="22" y1="100" x2="12" y2="100" />
            <line x1="32.5" y1="61" x2="23.8" y2="56" />
          </g>
        </svg>
        <div className="dial-readout">
          <div className="dial-time">{fmt(remaining)}</div>
          <div className="dial-mode">
            {mode === 'focus' ? 'Focus' : 'Pause'} — {category || '—'}
          </div>
        </div>
      </div>

      <div className="cat-select-row">
        <label htmlFor="active-cat">Catégorie active</label>
        <CategorySelect id="active-cat" value={category} onChange={setCategory} />
      </div>

      {active.length === 0 && (
        <p className="muted-note">
          Aucune catégorie active — gérez vos catégories dans l'onglet Catégories.
        </p>
      )}

      <div className="timer-controls">
        <button type="button" className="btn primary" onClick={toggle} disabled={!category}>
          {running ? 'Pause' : 'Démarrer'}
        </button>
        <button type="button" className="btn" onClick={reset}>
          Réinitialiser
        </button>
      </div>

      <div className="sessions-tally">
        {tallyKeys.map((key) => {
          const n = tally.get(key) ?? 0;
          return (
            <div className="row" key={key}>
              <span>{key}</span>
              {n > 0 ? (
                <span className="dots" style={{ color: colorOf(key) }}>
                  {'●'.repeat(n)}
                </span>
              ) : (
                <span style={{ opacity: 0.4 }}>—</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
