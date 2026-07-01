import { useCallback, useEffect, useState } from 'react';
import type { Category, FocusSession, Task } from '../types.ts';
import { api, ApiError } from '../lib/api.ts';
import { CategorySelect } from './CategorySelect.tsx';
import { Timer } from './Timer.tsx';

export function TodayView({ day }: { day: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [advanced, setAdvanced] = useState('');
  const [dragged, setDragged] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulaire nouvelle tâche.
  const [newText, setNewText] = useState('');
  const [newCat, setNewCat] = useState<Category>('FORM');

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
    if (!text) return;
    try {
      const task = await api.createTask({ text, category: newCat, day });
      setTasks((prev) => [...prev, task]);
      setNewText('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ajout impossible');
    }
  }

  async function toggleTask(task: Task) {
    try {
      const updated = await api.updateTask(task.id, { done: !task.done });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Mise à jour impossible');
    }
  }

  async function removeTask(id: number) {
    try {
      await api.deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible');
    }
  }

  const onSessionComplete = useCallback(
    (category: Category, durationSec: number) => {
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
              <li key={t.id}>
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggleTask(t)}
                  aria-label={`Marquer « ${t.text} » comme ${t.done ? 'à faire' : 'terminé'}`}
                />
                <span className={`task-text${t.done ? ' done' : ''}`}>{t.text}</span>
                <span className="chip">{t.category}</span>
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
            <button type="button" className="btn primary" onClick={addTask}>
              + Ajouter
            </button>
          </div>

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
