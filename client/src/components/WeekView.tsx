import { useEffect, useState } from 'react';
import type { Goal, WeekAggregation } from '../types.ts';
import { api, ApiError } from '../lib/api.ts';
import { mondayOf, formatShort } from '../lib/date.ts';
import { useCategories } from '../context/CategoriesContext.tsx';
import { CategoryDot } from './CategoryDot.tsx';

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h${m.toString().padStart(2, '0')}`;
}

export function WeekView({ referenceDay }: { referenceDay: string }) {
  const { labelOf, colorOf } = useCategories();
  const start = mondayOf(referenceDay);
  const [week, setWeek] = useState<WeekAggregation | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([api.getWeek(start), api.getGoals()])
      .then(([w, g]) => {
        if (!alive) return;
        setWeek(w);
        setGoals(g);
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
  }, [start]);

  const maxHours = week ? Math.max(1, ...week.categories.map((c) => c.hours)) : 1;
  const activeCats = week ? week.categories.filter((c) => c.hours > 0) : [];
  const avg =
    activeCats.length > 0 ? activeCats.reduce((a, c) => a + c.hours, 0) / activeCats.length : 0;

  const weeklyGoals = goals.filter((g) => g.period === 'weekly' && g.target_hours !== null);

  // Heures réelles par catégorie (pour la progression vs buts hebdo).
  const hoursByCat = new Map(week?.categories.map((c) => [c.category, c.hours]) ?? []);

  return (
    <>
      {error && <div className="error-banner" role="alert">{error}</div>}

      <section className="panel">
        <p className="panel-title">Répartition hebdo</p>
        <p className="chart-caption">
          Temps focus réel — semaine du {formatShort(start)}
          {week ? ` au ${formatShort(week.end)}` : ''} · total{' '}
          {week ? formatHours(week.totalSeconds / 3600) : '—'}
        </p>

        {loading && <p className="muted-note">Chargement…</p>}
        {!loading && week && week.totalSeconds === 0 && (
          <p className="muted-note">Aucune session focus enregistrée cette semaine.</p>
        )}

        {!loading &&
          week &&
          week.categories.map((cat) => {
            const width = Math.round((cat.hours / maxHours) * 100);
            const warn = cat.hours > avg * 1.6 && avg > 0;
            return (
              <div key={cat.category}>
                <div className="bar-row">
                  <span className="bar-label">
                    <CategoryDot categoryKey={cat.category} /> {cat.category}
                  </span>
                  <div className="bar-track">
                    <div
                      className={`bar-fill${warn ? ' warn' : ''}`}
                      style={{
                        width: `${width}%`,
                        background: warn ? undefined : colorOf(cat.category),
                      }}
                    />
                  </div>
                  <span className="bar-value">{formatHours(cat.hours)}</span>
                </div>
                {warn && (
                  <div className="warn-note">▲ nettement au-dessus des autres catégories</div>
                )}
              </div>
            );
          })}
      </section>

      <section className="panel">
        <p className="panel-title">Progression vs buts hebdo</p>
        {weeklyGoals.length === 0 ? (
          <p className="muted-note">
            Aucun but hebdomadaire avec objectif d’heures. Ajoute-en dans l’onglet Buts.
          </p>
        ) : (
          weeklyGoals.map((goal) => {
            const target = goal.target_hours ?? 0;
            const actual = goal.category ? (hoursByCat.get(goal.category) ?? 0) : 0;
            const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
            const reached = actual >= target;
            return (
              <div key={goal.id} className="goal-progress">
                <div className="progress-label">
                  <span>
                    {goal.title}
                    {goal.category ? ` · ${labelOf(goal.category)}` : ''}
                  </span>
                  <span>
                    {formatHours(actual)} / {formatHours(target)}
                  </span>
                </div>
                <div className="progress-track">
                  <div
                    className={`progress-fill${reached ? ' ok' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
