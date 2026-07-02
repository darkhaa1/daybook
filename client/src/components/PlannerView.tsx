import { useEffect, useState } from 'react';
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

export function PlannerView({ referenceDay }: { referenceDay: string }) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(referenceDay));
  const [planner, setPlanner] = useState<PlannerWeek | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const today = todayISO();

  useEffect(() => {
    let alive = true;
    setLoading(true);
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
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Déplacement impossible');
    }
  }

  async function deleteTask(id: number) {
    try {
      await api.deleteTask(id);
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
  onOpenDay,
  onAddTask,
  onPatchTask,
  onMoveTask,
  onDeleteTask,
}: ColumnProps) {
  const { active } = useCategories();
  const [newText, setNewText] = useState('');
  const [newCat, setNewCat] = useState('');

  useEffect(() => {
    if (!newCat && active.length > 0) {
      const first = active[0];
      if (first) setNewCat(first.key);
    }
  }, [active, newCat]);

  function submit() {
    const text = newText.trim();
    if (!text || !newCat) return;
    onAddTask(data.day, { text, category: newCat });
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
        {data.tasks.map((t) => (
          <li key={t.id} className="planner-task">
            <div className="planner-task-top">
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => onPatchTask(t, { done: !t.done })}
                aria-label={`Marquer « ${t.text} » comme ${t.done ? 'à faire' : 'terminé'}`}
              />
              <input
                type="text"
                className={`task-text-input${t.done ? ' done' : ''}`}
                defaultValue={t.text}
                aria-label="Texte de la tâche"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== t.text) onPatchTask(t, { text: v });
                  else e.target.value = t.text;
                }}
              />
              <button
                type="button"
                className="del-btn"
                onClick={() => onDeleteTask(t.id)}
                aria-label={`Supprimer « ${t.text} »`}
              >
                ×
              </button>
            </div>
            <div className="planner-times">
              <input
                type="time"
                className="task-time-input"
                defaultValue={t.start_time ?? ''}
                aria-label={`Heure de début de « ${t.text} »`}
                onChange={(e) => onPatchTask(t, { start_time: e.target.value || null })}
              />
              <input
                type="time"
                className="task-time-input"
                defaultValue={t.end_time ?? ''}
                aria-label={`Heure de fin de « ${t.text} »`}
                onChange={(e) => onPatchTask(t, { end_time: e.target.value || null })}
              />
            </div>
            <div className="planner-task-controls">
              <CategoryDot categoryKey={t.category} />
              <CategorySelect
                value={t.category}
                onChange={(v) => onPatchTask(t, { category: v })}
                ariaLabel={`Catégorie de « ${t.text} »`}
              />
              <select
                className="planner-move"
                value={t.day}
                onChange={(e) => onMoveTask(t, e.target.value)}
                aria-label={`Déplacer « ${t.text} » vers un autre jour`}
              >
                {weekDays.map((wd, i) => (
                  <option key={wd} value={wd}>
                    {WEEKDAY_LABELS[i] ?? wd}
                  </option>
                ))}
              </select>
            </div>
          </li>
        ))}
      </ul>

      <div className="planner-add">
        <input
          type="text"
          value={newText}
          placeholder="+ tâche…"
          aria-label={`Nouvelle tâche le ${label}`}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
        <div className="planner-add-row">
          <CategorySelect value={newCat} onChange={setNewCat} ariaLabel="Catégorie" />
          <button type="button" className="btn" onClick={submit} disabled={!newCat}>
            +
          </button>
        </div>
      </div>
    </div>
  );
}
