import { useEffect, useState } from 'react';
import type { Goal, Period } from '../types.ts';
import { api, ApiError } from '../lib/api.ts';
import { CategorySelect } from './CategorySelect.tsx';
import { CategoryChip } from './CategoryChip.tsx';

type Filter = 'all' | Period;

export function GoalsView() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  // Formulaire nouveau but.
  const [title, setTitle] = useState('');
  const [period, setPeriod] = useState<Period>('weekly');
  const [category, setCategory] = useState('');
  const [targetHours, setTargetHours] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .getGoals()
      .then((g) => {
        if (alive) {
          setGoals(g);
          setError(null);
        }
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
  }, []);

  async function addGoal() {
    const trimmed = title.trim();
    if (!trimmed) return;
    const hours = targetHours.trim() === '' ? null : Number(targetHours);
    if (hours !== null && (!Number.isFinite(hours) || hours < 0)) {
      setError('Objectif d’heures invalide');
      return;
    }
    try {
      const goal = await api.createGoal({
        title: trimmed,
        period,
        category: category === '' ? null : category,
        target_hours: hours,
      });
      setGoals((prev) => [...prev, goal]);
      setTitle('');
      setTargetHours('');
      setCategory('');
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ajout impossible');
    }
  }

  async function toggleGoal(goal: Goal) {
    try {
      const updated = await api.updateGoal(goal.id, { done: !goal.done });
      setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Mise à jour impossible');
    }
  }

  async function removeGoal(id: number) {
    try {
      await api.deleteGoal(id);
      setGoals((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible');
    }
  }

  const visible = goals.filter((g) => filter === 'all' || g.period === filter);

  return (
    <>
      {error && <div className="error-banner" role="alert">{error}</div>}

      <section className="panel">
        <p className="panel-title">Nouveau but</p>
        <div className="goal-form">
          <input
            type="text"
            value={title}
            placeholder="Intitulé du but…"
            aria-label="Intitulé du but"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addGoal();
            }}
          />
          <select
            aria-label="Période"
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
          >
            <option value="weekly">Hebdomadaire</option>
            <option value="monthly">Mensuel</option>
          </select>
          <CategorySelect
            value={category}
            onChange={setCategory}
            ariaLabel="Catégorie (optionnelle)"
            includeEmpty={{ label: '— Sans catégorie —' }}
          />
          <input
            type="number"
            min="0"
            step="0.5"
            value={targetHours}
            placeholder="Heures (opt.)"
            aria-label="Objectif d’heures (optionnel)"
            onChange={(e) => setTargetHours(e.target.value)}
          />
          <button type="button" className="btn primary" onClick={addGoal}>
            + Ajouter
          </button>
        </div>
      </section>

      <section className="panel">
        <p className="panel-title">Buts</p>

        <div className="filter-row">
          {(['all', 'weekly', 'monthly'] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`btn${filter === f ? ' primary' : ''}`}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Tous' : f === 'weekly' ? 'Hebdo' : 'Mensuel'}
            </button>
          ))}
        </div>

        <ul className="goal-list">
          {loading && <li className="task-empty">Chargement…</li>}
          {!loading && visible.length === 0 && (
            <li className="task-empty">Aucun but pour ce filtre.</li>
          )}
          {visible.map((g) => (
            <li key={g.id}>
              <input
                type="checkbox"
                checked={g.done}
                onChange={() => toggleGoal(g)}
                aria-label={`Marquer « ${g.title} » comme ${g.done ? 'à faire' : 'atteint'}`}
              />
              <span className={`task-text${g.done ? ' done' : ''}`}>{g.title}</span>
              <span className="chip">{g.period === 'weekly' ? 'HEBDO' : 'MENSUEL'}</span>
              {g.category && <CategoryChip categoryKey={g.category} />}
              {g.target_hours !== null && <span className="chip">{g.target_hours}h</span>}
              <button
                type="button"
                className="del-btn"
                onClick={() => removeGoal(g.id)}
                aria-label={`Supprimer « ${g.title} »`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
