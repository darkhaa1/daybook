import { useCallback, useEffect, useState } from 'react';
import type { FocusSession, Task } from '../types.ts';
import { api, ApiError } from '../lib/api.ts';
import { CategorySelect } from './CategorySelect.tsx';
import { Timer } from './Timer.tsx';
import { useCategories } from '../context/CategoriesContext.tsx';

export function TodayView({ day }: { day: string }) {
  const { active } = useCategories();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [advanced, setAdvanced] = useState('');
  const [dragged, setDragged] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulaire nouvelle tâche.
  const [newText, setNewText] = useState('');
  const [newCat, setNewCat] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');

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
        setTasks(data.tasks);
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
    const text = newText.trim();
    if (!text || !newCat) return;
    try {
      const task = await api.createTask({
        text,
        category: newCat,
        day,
        start_time: newStart || null,
        end_time: newEnd || null,
      });
      setTasks((prev) => [...prev, task]);
      setNewText('');
      setNewStart('');
      setNewEnd('');
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ajout impossible');
    }
  }

  async function patchTask(
    task: Task,
    data: Partial<{
      done: boolean;
      text: string;
      category: string;
      start_time: string | null;
      end_time: string | null;
    }>,
  ) {
    try {
      const updated = await api.updateTask(task.id, data);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Mise à jour impossible');
    }
  }

  async function removeTask(id: number) {
    try {
      await api.deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
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

  return (
    <>
      {error && <div className="error-banner" role="alert">{error}</div>}

      <div className="grid">
        {/* Panel A : Priorités */}
        <section className="panel">
          <p className="panel-title">A — Priorités du jour</p>

          <ul className="task-list">
            {loading && <li className="task-empty">Chargement…</li>}
            {!loading && tasks.length === 0 && (
              <li className="task-empty">Aucune priorité pour aujourd’hui.</li>
            )}
            {tasks.map((t) => (
              <li key={t.id} className="task-row">
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => patchTask(t, { done: !t.done })}
                  aria-label={`Marquer « ${t.text} » comme ${t.done ? 'à faire' : 'terminé'}`}
                />
                <input
                  type="time"
                  className="task-time-input"
                  defaultValue={t.start_time ?? ''}
                  aria-label={`Heure de début de « ${t.text} »`}
                  onChange={(e) => patchTask(t, { start_time: e.target.value || null })}
                />
                <input
                  type="time"
                  className="task-time-input"
                  defaultValue={t.end_time ?? ''}
                  aria-label={`Heure de fin de « ${t.text} »`}
                  onChange={(e) => patchTask(t, { end_time: e.target.value || null })}
                />
                <input
                  type="text"
                  className={`task-text-input${t.done ? ' done' : ''}`}
                  defaultValue={t.text}
                  aria-label="Texte de la tâche"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== t.text) patchTask(t, { text: v });
                    else e.target.value = t.text;
                  }}
                />
                <CategorySelect
                  value={t.category}
                  onChange={(v) => patchTask(t, { category: v })}
                  ariaLabel={`Catégorie de « ${t.text} »`}
                />
                <button
                  type="button"
                  className="del-btn"
                  onClick={() => removeTask(t.id)}
                  aria-label={`Supprimer « ${t.text} »`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          <div className="add-row">
            <input
              type="time"
              className="task-time-input"
              value={newStart}
              aria-label="Heure de début (optionnelle)"
              onChange={(e) => setNewStart(e.target.value)}
            />
            <input
              type="time"
              className="task-time-input"
              value={newEnd}
              aria-label="Heure de fin (optionnelle)"
              onChange={(e) => setNewEnd(e.target.value)}
            />
            <input
              type="text"
              value={newText}
              placeholder="Nouvelle tâche…"
              aria-label="Nouvelle tâche"
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
