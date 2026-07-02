import { useEffect, useRef, useState } from 'react';
import type { PlannerDay, PlannerWeek, Task } from '../types.ts';
import { api, ApiError } from '../lib/api.ts';
import { addDays, formatDayMonth, formatShort, mondayOf, todayISO, WEEKDAY_LABELS } from '../lib/date.ts';
import { useCategories } from '../context/CategoriesContext.tsx';
import { CategorySelect } from './CategorySelect.tsx';
import { CategoryDot } from './CategoryDot.tsx';

type TaskPatch = Partial<{
  done: boolean;
  text: string;
  category: string;
  start_time: string | null;
  end_time: string | null;
}>;

// Créneau compact "08:00–09:00" en lecture ; "—" si non planifiée.
function formatSlot(task: Task): string {
  if (task.start_time && task.end_time) return `${task.start_time}–${task.end_time}`;
  if (task.start_time) return task.start_time;
  if (task.end_time) return `–${task.end_time}`;
  return '—';
}

export function PlannerView({ referenceDay }: { referenceDay: string }) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(referenceDay));
  const [planner, setPlanner] = useState<PlannerWeek | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Une seule tâche en édition à la fois, toutes colonnes confondues.
  const [editingId, setEditingId] = useState<number | null>(null);
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

  async function moveTask(task: Task, day: string) {
    if (day === task.day) return;
    try {
      await api.updateTask(task.id, { day });
      setEditingId(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Déplacement impossible');
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

  const weekDays = planner?.days.map((d) => d.day) ?? [];
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
                weekDays={weekDays}
                editingId={editingId}
                onStartEdit={setEditingId}
                onCloseEdit={() => setEditingId(null)}
                onOpenDay={openDay}
                onAddTask={addTask}
                onPatchTask={patchTask}
                onMoveTask={moveTask}
                onDeleteTask={deleteTask}
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
  weekDays: string[];
  editingId: number | null;
  onStartEdit: (id: number) => void;
  onCloseEdit: () => void;
  onOpenDay: (day: string) => void;
  onAddTask: (day: string, data: { text: string; category: string }) => void;
  onPatchTask: (task: Task, data: TaskPatch) => void;
  onMoveTask: (task: Task, day: string) => void;
  onDeleteTask: (id: number) => void;
}

function PlannerDayColumn({
  data,
  label,
  isToday,
  weekDays,
  editingId,
  onStartEdit,
  onCloseEdit,
  onOpenDay,
  onAddTask,
  onPatchTask,
  onMoveTask,
  onDeleteTask,
}: ColumnProps) {
  const { active } = useCategories();
  const [newText, setNewText] = useState('');
  const noCategory = active.length === 0;

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

      <ul className="planner-tasks">
        {data.tasks.length === 0 && <li className="planner-empty">—</li>}
        {data.tasks.map((t) =>
          t.id === editingId ? (
            <PlannerTaskEditor
              key={t.id}
              task={t}
              weekDays={weekDays}
              onClose={onCloseEdit}
              onPatch={onPatchTask}
              onMove={onMoveTask}
              onDelete={onDeleteTask}
            />
          ) : (
            <PlannerTaskLine key={t.id} task={t} onPatch={onPatchTask} onOpen={onStartEdit} />
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
// [pastille = toggle done] [créneau mono] [titre ellipsé -> clic = édition]
function PlannerTaskLine({
  task,
  onPatch,
  onOpen,
}: {
  task: Task;
  onPatch: (task: Task, data: TaskPatch) => void;
  onOpen: (id: number) => void;
}) {
  return (
    <li className={`planner-task-line${task.done ? ' done' : ''}`}>
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
    </li>
  );
}

// --- Mode édition : carte complète, une seule ouverte à la fois ---
// Enter valide, Escape annule (texte non commité), clic hors de la carte ferme.
interface EditorProps {
  task: Task;
  weekDays: string[];
  onClose: () => void;
  onPatch: (task: Task, data: TaskPatch) => void;
  onMove: (task: Task, day: string) => void;
  onDelete: (id: number) => void;
}

function PlannerTaskEditor({ task, weekDays, onClose, onPatch, onMove, onDelete }: EditorProps) {
  const cardRef = useRef<HTMLLIElement | null>(null);
  const textRef = useRef<HTMLInputElement | null>(null);

  function commitText() {
    const v = textRef.current?.value.trim();
    if (v && v !== task.text) onPatch(task, { text: v });
  }

  // Clic hors de la carte -> commit du texte en cours puis fermeture.
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
      className="planner-task-edit"
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
      <input
        ref={textRef}
        type="text"
        defaultValue={task.text}
        autoFocus
        aria-label="Texte de la tâche"
        onBlur={commitText}
      />
      <div className="planner-edit-times">
        <input
          type="time"
          defaultValue={task.start_time ?? ''}
          aria-label={`Heure de début de « ${task.text} »`}
          onChange={(e) => onPatch(task, { start_time: e.target.value || null })}
        />
        <span className="planner-edit-dash" aria-hidden="true">
          –
        </span>
        <input
          type="time"
          defaultValue={task.end_time ?? ''}
          aria-label={`Heure de fin de « ${task.text} »`}
          onChange={(e) => onPatch(task, { end_time: e.target.value || null })}
        />
      </div>
      <CategorySelect
        value={task.category}
        onChange={(v) => onPatch(task, { category: v })}
        ariaLabel={`Catégorie de « ${task.text} »`}
      />
      <select
        value={task.day}
        onChange={(e) => onMove(task, e.target.value)}
        aria-label={`Déplacer « ${task.text} » vers un autre jour`}
      >
        {weekDays.map((wd, i) => (
          <option key={wd} value={wd}>
            {WEEKDAY_LABELS[i] ?? wd}
          </option>
        ))}
      </select>
      <div className="planner-edit-actions">
        <button type="button" className="btn del-danger" onClick={() => onDelete(task.id)}>
          Suppr.
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            commitText();
            onClose();
          }}
        >
          OK
        </button>
      </div>
    </li>
  );
}
