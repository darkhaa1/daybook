import { useEffect, useRef, useState } from 'react';
import type { PlannerDay, PlannerWeek, Task } from '../types.ts';
import { api, ApiError } from '../lib/api.ts';
import { addDays, formatDayMonth, formatShort, mondayOf, todayISO, WEEKDAY_LABELS } from '../lib/date.ts';
import { useCategories } from '../context/CategoriesContext.tsx';
import { CategoryDot } from './CategoryDot.tsx';

type TaskPatch = Partial<{
  done: boolean;
  text: string;
  category: string;
  start_time: string | null;
  end_time: string | null;
}>;

// Position d'insertion visée pendant un drag : index 0..tasks.length dans la
// liste affichée du jour.
interface DropHint {
  day: string;
  index: number;
}

// Créneau compact "08:00–09:00" en lecture ; "—" si non planifiée.
function formatSlot(task: Task): string {
  if (task.start_time && task.end_time) return `${task.start_time}–${task.end_time}`;
  if (task.start_time) return task.start_time;
  if (task.end_time) return `–${task.end_time}`;
  return '—';
}

// --- Helpers heures (minutes depuis minuit, bornées à la journée) ---
const DAY_MAX_MIN = 23 * 60 + 59;
const DEFAULT_DURATION_MIN = 60;

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

function toHHMM(min: number): string {
  const m = Math.max(0, Math.min(DAY_MAX_MIN, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function PlannerView({ referenceDay }: { referenceDay: string }) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(referenceDay));
  const [planner, setPlanner] = useState<PlannerWeek | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Une seule tâche en édition à la fois, toutes colonnes confondues.
  const [editingId, setEditingId] = useState<number | null>(null);
  // Drag en cours (id de la tâche) + position d'insertion survolée.
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);
  const today = todayISO();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setEditingId(null);
    api
      .getPlanner(weekStart)
      .then((data) => {
        if (!alive) return;
        setPlanner(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof ApiError ? err.message : 'Chargement impossible');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [weekStart]);

  // Rechargement silencieux (sans spinner) après une mutation.
  async function reload() {
    try {
      const data = await api.getPlanner(weekStart);
      setPlanner(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Chargement impossible');
    }
  }

  async function addTask(day: string, data: { text: string; category: string }) {
    try {
      await api.createTask({ text: data.text, category: data.category, day });
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ajout impossible');
    }
  }

  async function patchTask(task: Task, data: TaskPatch) {
    try {
      await api.updateTask(task.id, data);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Mise à jour impossible');
    }
  }

  async function deleteTask(id: number) {
    try {
      await api.deleteTask(id);
      setEditingId(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible');
    }
  }

  // Ouvre/matérialise le jour (GET /api/day applique le template si besoin) puis
  // rafraîchit la grille.
  async function openDay(day: string) {
    try {
      await api.getDay(day);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ouverture impossible');
    }
  }

  // Évite un re-render à chaque tick de dragover quand la position ne change pas.
  function updateDropHint(hint: DropHint | null) {
    setDropHint((cur) =>
      cur && hint && cur.day === hint.day && cur.index === hint.index ? cur : hint,
    );
  }

  // Dépose la tâche `id` à la position `index` de la liste affichée du jour
  // `day`. Le jour change si besoin, et les heures se recalent logiquement sur
  // les voisins planifiés : durée conservée, départ = fin de la tâche
  // précédente (ou arrivée = début de la suivante si déposée en tête).
  // Déposée dans la zone non planifiée ou sur un jour vide : heures inchangées.
  async function dropTask(id: number, day: string, index: number) {
    setDragId(null);
    setDropHint(null);
    if (!planner) return;

    const dragged = planner.days.flatMap((d) => d.tasks).find((t) => t.id === id);
    const target = planner.days.find((d) => d.day === day);
    if (!dragged || !target) return;

    // Liste cible sans la tâche déplacée (index d'insertion recalé si elle en venait).
    const origIdx = target.tasks.findIndex((t) => t.id === id);
    const list = target.tasks.filter((t) => t.id !== id);
    const insertIdx = origIdx !== -1 && origIdx < index ? index - 1 : index;

    const isScheduled = (t: Task) => t.start_time !== null || t.end_time !== null;
    const immPrev = insertIdx > 0 ? list[insertIdx - 1] : undefined;
    const immNext = insertIdx < list.length ? list[insertIdx] : undefined;

    const duration =
      dragged.start_time && dragged.end_time
        ? Math.max(0, toMinutes(dragged.end_time) - toMinutes(dragged.start_time))
        : DEFAULT_DURATION_MIN;

    let start: string | null = null;
    let end: string | null = null;
    if (immPrev && isScheduled(immPrev)) {
      const anchor = immPrev.end_time ?? immPrev.start_time;
      if (anchor) {
        const s = toMinutes(anchor);
        start = toHHMM(s);
        end = toHHMM(s + duration);
      }
    } else if (!immPrev && immNext && isScheduled(immNext)) {
      const anchor = immNext.start_time ?? immNext.end_time;
      if (anchor) {
        const e = toMinutes(anchor);
        start = toHHMM(e - duration);
        end = toHHMM(e);
      }
    }

    const patch: Partial<{ day: string; start_time: string | null; end_time: string | null }> = {};
    if (day !== dragged.day) patch.day = day;
    if (start !== null && (start !== dragged.start_time || end !== dragged.end_time)) {
      patch.start_time = start;
      patch.end_time = end;
    }
    if (Object.keys(patch).length === 0) return;

    try {
      await api.updateTask(id, patch);
      setEditingId(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Déplacement impossible');
    }
  }

  const rangeLabel = `${formatShort(weekStart)} — ${formatShort(addDays(weekStart, 6))}`;

  return (
    <>
      {error && <div className="error-banner" role="alert">{error}</div>}

      <section className="panel">
        <div className="planner-nav">
          <button
            type="button"
            className="btn"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            aria-label="Semaine précédente"
          >
            ‹ Sem.
          </button>
          <span className="planner-week-label">{rangeLabel}</span>
          <button
            type="button"
            className="btn"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            aria-label="Semaine suivante"
          >
            Sem. ›
          </button>
          <button type="button" className="btn primary" onClick={() => setWeekStart(mondayOf(today))}>
            Cette semaine
          </button>
        </div>

        {loading && <p className="muted-note">Chargement…</p>}

        {!loading && planner && (
          <div className="planner-grid">
            {planner.days.map((d, i) => (
              <PlannerDayColumn
                key={d.day}
                data={d}
                label={WEEKDAY_LABELS[i] ?? d.day}
                isToday={d.day === today}
                editingId={editingId}
                dragId={dragId}
                dropHint={dropHint}
                onStartEdit={setEditingId}
                onCloseEdit={() => setEditingId(null)}
                onOpenDay={openDay}
                onAddTask={addTask}
                onPatchTask={patchTask}
                onDeleteTask={deleteTask}
                onDragStartTask={setDragId}
                onDragEndTask={() => {
                  setDragId(null);
                  setDropHint(null);
                }}
                onDropHint={updateDropHint}
                onDropTask={dropTask}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

interface ColumnProps {
  data: PlannerDay;
  label: string;
  isToday: boolean;
  editingId: number | null;
  dragId: number | null;
  dropHint: DropHint | null;
  onStartEdit: (id: number) => void;
  onCloseEdit: () => void;
  onOpenDay: (day: string) => void;
  onAddTask: (day: string, data: { text: string; category: string }) => void;
  onPatchTask: (task: Task, data: TaskPatch) => void;
  onDeleteTask: (id: number) => void;
  onDragStartTask: (id: number) => void;
  onDragEndTask: () => void;
  onDropHint: (hint: DropHint | null) => void;
  onDropTask: (id: number, day: string, index: number) => void;
}

function PlannerDayColumn({
  data,
  label,
  isToday,
  editingId,
  dragId,
  dropHint,
  onStartEdit,
  onCloseEdit,
  onOpenDay,
  onAddTask,
  onPatchTask,
  onDeleteTask,
  onDragStartTask,
  onDragEndTask,
  onDropHint,
  onDropTask,
}: ColumnProps) {
  const { active } = useCategories();
  const [newText, setNewText] = useState('');
  const noCategory = active.length === 0;

  const hint = dropHint && dropHint.day === data.day ? dropHint : null;
  const lastIndex = data.tasks.length - 1;

  // Ajout rapide : Enter crée la tâche sans horaire, première catégorie active
  // par défaut — l'édition fine se fait ensuite via le mode édition.
  function submit() {
    const text = newText.trim();
    const first = active[0];
    if (!text || !first) return;
    onAddTask(data.day, { text, category: first.key });
    setNewText('');
  }

  return (
    <div className={`planner-day${isToday ? ' today' : ''}`}>
      <button
        type="button"
        className="planner-day-head"
        onClick={() => onOpenDay(data.day)}
        title="Ouvrir / matérialiser ce jour depuis le planning type"
      >
        <span className="planner-day-name">{label}</span>
        <span className="planner-day-date">{formatDayMonth(data.day)}</span>
        {!data.isApplied && <span className="planner-badge">non ouvert</span>}
      </button>

      <ul
        className={`planner-tasks${hint && data.tasks.length === 0 ? ' drop-in' : ''}`}
        onDragOver={(e) => {
          if (dragId === null) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          onDropHint({ day: data.day, index: data.tasks.length });
        }}
        onDrop={(e) => {
          e.preventDefault();
          const id = Number(e.dataTransfer.getData('text/plain'));
          if (Number.isInteger(id) && id > 0) onDropTask(id, data.day, data.tasks.length);
        }}
      >
        {data.tasks.length === 0 && <li className="planner-empty">—</li>}
        {data.tasks.map((t, i) =>
          t.id === editingId ? (
            <PlannerTaskEditor
              key={t.id}
              task={t}
              onClose={onCloseEdit}
              onPatch={onPatchTask}
              onDelete={onDeleteTask}
            />
          ) : (
            <PlannerTaskLine
              key={t.id}
              task={t}
              day={data.day}
              index={i}
              dragActive={dragId !== null}
              dragging={dragId === t.id}
              dropBefore={hint !== null && hint.index === i}
              dropAfter={hint !== null && i === lastIndex && hint.index === data.tasks.length}
              onPatch={onPatchTask}
              onOpen={onStartEdit}
              onDragStart={onDragStartTask}
              onDragEnd={onDragEndTask}
              onDropHint={onDropHint}
              onDropTask={onDropTask}
            />
          ),
        )}
      </ul>

      <div className="planner-add">
        <input
          type="text"
          value={newText}
          placeholder="+ tâche…"
          disabled={noCategory}
          aria-label={`Nouvelle tâche le ${label}`}
          title={noCategory ? 'Aucune catégorie active — gérez-les dans l’onglet Catégories.' : undefined}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
      </div>
    </div>
  );
}

// --- Mode lecture : une ligne compacte, zéro chrome ---
// [pastille = toggle done] [créneau mono] [titre -> clic = édition] [≡ = drag]
interface LineProps {
  task: Task;
  day: string;
  index: number;
  dragActive: boolean;
  dragging: boolean;
  dropBefore: boolean;
  dropAfter: boolean;
  onPatch: (task: Task, data: TaskPatch) => void;
  onOpen: (id: number) => void;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  onDropHint: (hint: DropHint) => void;
  onDropTask: (id: number, day: string, index: number) => void;
}

function PlannerTaskLine({
  task,
  day,
  index,
  dragActive,
  dragging,
  dropBefore,
  dropAfter,
  onPatch,
  onOpen,
  onDragStart,
  onDragEnd,
  onDropHint,
  onDropTask,
}: LineProps) {
  const liRef = useRef<HTMLLIElement | null>(null);

  // Position d'insertion selon la moitié survolée de la ligne.
  function dropIndexFromEvent(e: { clientY: number }): number {
    const rect = liRef.current?.getBoundingClientRect();
    if (!rect) return index;
    return e.clientY < rect.top + rect.height / 2 ? index : index + 1;
  }

  const classes = [
    'planner-task-line',
    task.done ? 'done' : '',
    dragging ? 'dragging' : '',
    dropBefore ? 'drop-before' : '',
    dropAfter ? 'drop-after' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li
      ref={liRef}
      className={classes}
      onDragOver={(e) => {
        if (!dragActive || dragging) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        onDropHint({ day, index: dropIndexFromEvent(e) });
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = Number(e.dataTransfer.getData('text/plain'));
        if (Number.isInteger(id) && id > 0) onDropTask(id, day, dropIndexFromEvent(e));
      }}
    >
      <button
        type="button"
        className="planner-task-toggle"
        aria-pressed={task.done}
        aria-label={`Marquer « ${task.text} » comme ${task.done ? 'à faire' : 'terminé'}`}
        onClick={() => onPatch(task, { done: !task.done })}
      >
        <CategoryDot categoryKey={task.category} />
      </button>
      <button
        type="button"
        className="planner-task-open"
        title={task.text}
        aria-label={`Modifier « ${task.text} »`}
        onClick={() => onOpen(task.id)}
      >
        <span className="planner-task-slot">{formatSlot(task)}</span>
        <span className="planner-task-title">{task.text}</span>
      </button>
      <span
        className="planner-task-grip"
        title="Glisser pour déplacer"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', String(task.id));
          e.dataTransfer.effectAllowed = 'move';
          if (liRef.current) e.dataTransfer.setDragImage(liRef.current, 24, 14);
          onDragStart(task.id);
        }}
        onDragEnd={onDragEnd}
      >
        ≡
      </span>
    </li>
  );
}

// --- Mode édition inline : la ligne devient éditable sur place (heures + texte),
// une seule à la fois. Enter valide, Escape annule (texte non commité), clic
// hors de la ligne commit + ferme. × supprime.
interface EditorProps {
  task: Task;
  onClose: () => void;
  onPatch: (task: Task, data: TaskPatch) => void;
  onDelete: (id: number) => void;
}

function PlannerTaskEditor({ task, onClose, onPatch, onDelete }: EditorProps) {
  const cardRef = useRef<HTMLLIElement | null>(null);
  const textRef = useRef<HTMLInputElement | null>(null);

  function commitText() {
    const v = textRef.current?.value.trim();
    if (v && v !== task.text) onPatch(task, { text: v });
  }

  // Clic hors de la ligne -> commit du texte en cours puis fermeture.
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const card = cardRef.current;
      if (!card || !(e.target instanceof Node) || card.contains(e.target)) return;
      const v = textRef.current?.value.trim();
      if (v && v !== task.text) onPatch(task, { text: v });
      onClose();
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [task, onPatch, onClose]);

  return (
    <li
      className="planner-task-inline-edit"
      ref={cardRef}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitText();
          onClose();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div className="planner-inline-times">
        <input
          type="time"
          defaultValue={task.start_time ?? ''}
          aria-label={`Heure de début de « ${task.text} »`}
          onChange={(e) => onPatch(task, { start_time: e.target.value || null })}
        />
        <span className="planner-inline-dash" aria-hidden="true">
          –
        </span>
        <input
          type="time"
          defaultValue={task.end_time ?? ''}
          aria-label={`Heure de fin de « ${task.text} »`}
          onChange={(e) => onPatch(task, { end_time: e.target.value || null })}
        />
        <button
          type="button"
          className="del-btn planner-inline-del"
          onClick={() => onDelete(task.id)}
          aria-label={`Supprimer « ${task.text} »`}
          title="Supprimer"
        >
          ×
        </button>
      </div>
      <input
        ref={textRef}
        type="text"
        defaultValue={task.text}
        autoFocus
        aria-label="Texte de la tâche"
        onBlur={commitText}
      />
    </li>
  );
}
