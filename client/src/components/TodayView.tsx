import { Fragment, useCallback, useEffect, useState } from 'react';
import type { FocusSession, Task } from '../types.ts';
import { api, ApiError } from '../lib/api.ts';
import { extractLeadingSlot } from '../lib/timeText.ts';
import { CategorySelect } from './CategorySelect.tsx';
import {
  isOngoing,
  NowLine,
  nowLineIndex,
  TaskInlineEditor,
  TaskLineBody,
  useNowHHMM,
  type TaskPatch,
} from './TaskItem.tsx';
import { Timer } from './Timer.tsx';
import { useCategories } from '../context/CategoriesContext.tsx';

// Même ordre que le serveur : planifiées en chrono d'abord, non-planifiées en
// fin — appliqué localement pour re-trier dès qu'une heure change.
function sortTasks(list: Task[]): Task[] {
  return [...list].sort((a, b) => {
    const an = a.start_time === null ? 1 : 0;
    const bn = b.start_time === null ? 1 : 0;
    if (an !== bn) return an - bn;
    if (a.start_time && b.start_time && a.start_time !== b.start_time) {
      return a.start_time < b.start_time ? -1 : 1;
    }
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
    return a.id - b.id;
  });
}

export function TodayView({ day }: { day: string }) {
  const { active } = useCategories();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [advanced, setAdvanced] = useState('');
  const [dragged, setDragged] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Une seule tâche en édition à la fois (édition inline au clic).
  const [editingId, setEditingId] = useState<number | null>(null);

  // Formulaire nouvelle tâche — l'heure se tape dans le texte : "9-10h30 Réviser".
  const [newText, setNewText] = useState('');
  const [newCat, setNewCat] = useState('');

  // Sélectionne la première catégorie active dès qu'elle est disponible.
  useEffect(() => {
    if (!newCat && active.length > 0) {
      const first = active[0];
      if (first) setNewCat(first.key);
    }
  }, [active, newCat]);

  // Confirmation "Enregistré" du bilan.
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .getDay(day)
      .then((data) => {
        if (!alive) return;
        setTasks(sortTasks(data.tasks));
        setSessions(data.sessions);
        setAdvanced(data.review?.advanced ?? '');
        setDragged(data.review?.dragged ?? '');
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
  }, [day]);

  async function addTask() {
    const { start, end, text } = extractLeadingSlot(newText);
    if (!text || !newCat) return;
    try {
      const task = await api.createTask({
        text,
        category: newCat,
        day,
        start_time: start,
        end_time: end,
      });
      setTasks((prev) => sortTasks([...prev, task]));
      setNewText('');
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ajout impossible');
    }
  }

  async function patchTask(task: Task, data: TaskPatch) {
    try {
      const updated = await api.updateTask(task.id, data);
      setTasks((prev) => sortTasks(prev.map((t) => (t.id === updated.id ? updated : t))));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Mise à jour impossible');
    }
  }

  async function removeTask(id: number) {
    try {
      await api.deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setEditingId((cur) => (cur === id ? null : cur));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible');
    }
  }

  const onSessionComplete = useCallback(
    (category: string, durationSec: number) => {
      api
        .createSession({ category, duration_sec: durationSec, day })
        .then((session) => setSessions((prev) => [...prev, session]))
        .catch((err: unknown) =>
          setError(err instanceof ApiError ? err.message : 'Session non enregistrée'),
        );
    },
    [day],
  );

  async function saveReview() {
    try {
      await api.saveReview(day, { advanced, dragged });
      setSavedFlash(true);
      setError(null);
      window.setTimeout(() => setSavedFlash(false), 1800);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Bilan non enregistré');
    }
  }

  const done = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  // Repère « maintenant » : inséré à la position chronologique courante.
  const now = useNowHHMM();
  const nowIdx = loading ? null : nowLineIndex(tasks, now);

  return (
    <>
      {error && <div className="error-banner" role="alert">{error}</div>}

      <div className="grid">
        {/* Panel A : Priorités */}
        <section className="panel">
          <p className="panel-title">A — Priorités du jour</p>

          <ul className="task-lines">
            {loading && <li className="task-empty">Chargement…</li>}
            {!loading && tasks.length === 0 && (
              <li className="task-empty">Aucune priorité pour aujourd’hui.</li>
            )}
            {tasks.map((t, i) => (
              <Fragment key={t.id}>
                {nowIdx === i && <NowLine now={now} />}
                {t.id === editingId ? (
                  <TaskInlineEditor
                    task={t}
                    onClose={() => setEditingId(null)}
                    onPatch={patchTask}
                    onDelete={removeTask}
                  />
                ) : (
                  <li
                    className={`planner-task-line${t.done ? ' done' : ''}${
                      isOngoing(t, now) ? ' now-current' : ''
                    }`}
                  >
                    <TaskLineBody task={t} onPatch={patchTask} onOpen={setEditingId} />
                  </li>
                )}
              </Fragment>
            ))}
            {nowIdx !== null && nowIdx === tasks.length && <NowLine now={now} />}
          </ul>

          <div className="add-row">
            <input
              type="text"
              value={newText}
              placeholder="9-10h30 Nouvelle tâche… (heure optionnelle)"
              aria-label="Nouvelle tâche (créneau 24h optionnel en tête, ex : 9-10h30 Réviser)"
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTask();
              }}
            />
            <CategorySelect value={newCat} onChange={setNewCat} ariaLabel="Catégorie" />
            <button type="button" className="btn primary" onClick={addTask} disabled={!newCat}>
              + Ajouter
            </button>
          </div>
          {active.length === 0 && (
            <p className="muted-note">
              Aucune catégorie active — gérez vos catégories dans l'onglet Catégories.
            </p>
          )}

          <div className="progress-label">
            <span>
              {done}/{total} tâches
            </span>
            <span>{pct}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </section>

        {/* Panel B : Focus */}
        <Timer sessions={sessions} onSessionComplete={onSessionComplete} />
      </div>

      {/* Panel D : Bilan du soir */}
      <section className="panel">
        <p className="panel-title">D — Bilan du soir</p>
        <div className="reflect-grid">
          <div>
            <label htmlFor="advance">Ce qui a avancé</label>
            <textarea
              id="advance"
              value={advanced}
              placeholder="…"
              onChange={(e) => setAdvanced(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="traine">Ce qui a traîné</label>
            <textarea
              id="traine"
              value={dragged}
              placeholder="…"
              onChange={(e) => setDragged(e.target.value)}
            />
          </div>
        </div>
        <div className="save-row">
          <button type="button" className="btn primary" onClick={saveReview}>
            Enregistrer
          </button>
          <span className={`confirm${savedFlash ? ' show' : ''}`}>✓ Enregistré</span>
        </div>
      </section>
    </>
  );
}
