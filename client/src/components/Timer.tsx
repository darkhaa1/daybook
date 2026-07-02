import { useEffect, useRef, useState } from 'react';
import type { FocusSession } from '../types.ts';
import { CategorySelect } from './CategorySelect.tsx';
import { CategoryDot } from './CategoryDot.tsx';
import { useCategories } from '../context/CategoriesContext.tsx';

const CIRC = 515.2; // 2πr, r = 82 (identique à la maquette)

type Mode = 'focus' | 'break';

// Durées réglables, persistées comme préférence d'affichage (même famille que
// console.activeTab) — les données métier restent en SQLite.
const KEY_WORK = 'console.timer.workMin';
const KEY_BREAK = 'console.timer.breakMin';
const MIN_MINUTES = 1;
const MAX_MINUTES = 180;

function loadMinutes(key: string, fallback: number): number {
  const v = Number(localStorage.getItem(key) ?? '');
  return Number.isInteger(v) && v >= MIN_MINUTES && v <= MAX_MINUTES ? v : fallback;
}

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

// "13:40–14:05" reconstruit depuis ended_at et la durée de la session.
function sessionRange(s: FocusSession): string {
  const end = new Date(s.ended_at);
  const start = new Date(end.getTime() - s.duration_sec * 1000);
  const f = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${f(start)}–${f(end)}`;
}

function formatTotal(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
}

export function Timer({ sessions, onSessionComplete }: Props) {
  const { active } = useCategories();
  const [category, setCategory] = useState('');
  const [mode, setMode] = useState<Mode>('focus');
  const [workMin, setWorkMin] = useState(() => loadMinutes(KEY_WORK, 25));
  const [breakMin, setBreakMin] = useState(() => loadMinutes(KEY_BREAK, 5));
  // Champs libres (permettent d'effacer/taper), renormalisés au blur.
  const [workStr, setWorkStr] = useState(() => String(loadMinutes(KEY_WORK, 25)));
  const [breakStr, setBreakStr] = useState(() => String(loadMinutes(KEY_BREAK, 5)));
  const [remaining, setRemaining] = useState(() => loadMinutes(KEY_WORK, 25) * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    localStorage.setItem(KEY_WORK, String(workMin));
  }, [workMin]);
  useEffect(() => {
    localStorage.setItem(KEY_BREAK, String(breakMin));
  }, [breakMin]);

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
  const workSecRef = useRef(workMin * 60);
  const breakSecRef = useRef(breakMin * 60);
  modeRef.current = mode;
  categoryRef.current = category;
  workSecRef.current = workMin * 60;
  breakSecRef.current = breakMin * 60;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev > 1) return prev - 1;
        // Fin de la phase courante.
        if (modeRef.current === 'focus') {
          onSessionComplete(categoryRef.current, workSecRef.current);
          setMode('break');
          setRunning(false);
          return breakSecRef.current;
        }
        setMode('focus');
        setRunning(false);
        return workSecRef.current;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, onSessionComplete]);

  // Applique une durée saisie (si valide) ; recale le compteur si la phase
  // concernée est affichée et à l'arrêt.
  function applyMinutes(raw: string, target: Mode) {
    const v = Number(raw);
    if (!Number.isInteger(v) || v < MIN_MINUTES || v > MAX_MINUTES) return;
    if (target === 'focus') setWorkMin(v);
    else setBreakMin(v);
    if (!running && mode === target) setRemaining(v * 60);
  }

  function switchMode(m: Mode) {
    if (running || mode === m) return;
    setMode(m);
    setRemaining((m === 'focus' ? workMin : breakMin) * 60);
  }

  function toggle() {
    setRunning((r) => !r);
  }

  function reset() {
    setRunning(false);
    setRemaining((mode === 'focus' ? workMin : breakMin) * 60);
  }

  const total = (mode === 'focus' ? workMin : breakMin) * 60;
  const frac = remaining / total;
  const dashoffset = CIRC * (1 - frac);

  const totalFocusSec = sessions.reduce((sum, s) => sum + s.duration_sec, 0);

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

      {/* Durées réglables + bascule de phase (désactivées pendant le décompte). */}
      <div className="timer-settings">
        <div className="timer-setting">
          <button
            type="button"
            className={`btn${mode === 'focus' ? ' primary' : ''}`}
            aria-pressed={mode === 'focus'}
            disabled={running}
            onClick={() => switchMode('focus')}
          >
            Focus
          </button>
          <input
            type="number"
            className="timer-min"
            min={MIN_MINUTES}
            max={MAX_MINUTES}
            value={workStr}
            disabled={running}
            aria-label="Durée focus (minutes)"
            onChange={(e) => {
              setWorkStr(e.target.value);
              applyMinutes(e.target.value, 'focus');
            }}
            onBlur={() => setWorkStr(String(workMin))}
          />
          <span className="timer-min-unit">min</span>
        </div>
        <div className="timer-setting">
          <button
            type="button"
            className={`btn${mode === 'break' ? ' primary' : ''}`}
            aria-pressed={mode === 'break'}
            disabled={running}
            onClick={() => switchMode('break')}
          >
            Pause
          </button>
          <input
            type="number"
            className="timer-min"
            min={MIN_MINUTES}
            max={MAX_MINUTES}
            value={breakStr}
            disabled={running}
            aria-label="Durée pause (minutes)"
            onChange={(e) => {
              setBreakStr(e.target.value);
              applyMinutes(e.target.value, 'break');
            }}
            onBlur={() => setBreakStr(String(breakMin))}
          />
          <span className="timer-min-unit">min</span>
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

      {/* Journal réel des sessions du jour — vide au départ, se remplit au fil
          des focus terminés (quand, sur quoi, combien de temps). */}
      <div className="focus-log">
        {sessions.length === 0 && (
          <p className="muted-note">Aucune session pour l'instant — lance un focus.</p>
        )}
        {sessions.map((s) => (
          <div className="row" key={s.id}>
            <span className="focus-log-range">{sessionRange(s)}</span>
            <span className="focus-log-cat">
              <CategoryDot categoryKey={s.category} /> {s.category}
            </span>
            <span className="focus-log-dur">{Math.round(s.duration_sec / 60)}min</span>
          </div>
        ))}
        {sessions.length > 0 && (
          <div className="focus-log-total">
            <span>Total focus</span>
            <span>{formatTotal(totalFocusSec)}</span>
          </div>
        )}
      </div>
    </section>
  );
}
