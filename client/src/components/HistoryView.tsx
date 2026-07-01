import { useEffect, useState } from 'react';
import type { HistoryResponse } from '../types.ts';
import { api, ApiError } from '../lib/api.ts';
import { useCategories } from '../context/CategoriesContext.tsx';
import { CategoryDot } from './CategoryDot.tsx';
import { formatShort } from '../lib/date.ts';

const DAYS = 30;

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h${m.toString().padStart(2, '0')}`;
}

function intensityLevel(hours: number, max: number): number {
  if (hours <= 0 || max <= 0) return 0;
  const ratio = hours / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

export function HistoryView() {
  const { labelOf, colorOf } = useCategories();
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .getHistory(DAYS)
      .then((res) => {
        if (!alive) return;
        setData(res);
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
  }, []);

  if (loading) {
    return (
      <section className="panel">
        <p className="panel-title">Historique</p>
        <p className="muted-note">Chargement…</p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <div className="error-banner" role="alert">
        {error ?? 'Historique indisponible'}
      </div>
    );
  }

  const { days, summary } = data;
  const maxFocus = Math.max(1, ...days.map((d) => d.focusHours));
  const maxSummaryHours = Math.max(1, ...summary.categories.map((c) => c.hours));
  const antichronological = [...days].reverse();

  return (
    <>
      <section className="panel">
        <p className="panel-title">
          Résumé — {formatShort(summary.start)} au {formatShort(summary.end)}
        </p>
        <div className="history-summary">
          <div className="summary-stat">
            <span className="summary-value">{summary.activeDays}</span>
            <span className="summary-label">jours actifs / {days.length}</span>
          </div>
          <div className="summary-stat">
            <span className="summary-value">{summary.tasksDone}</span>
            <span className="summary-label">tâches faites</span>
          </div>
        </div>
        {summary.categories
          .filter((c) => c.hours > 0)
          .map((cat) => (
            <div key={cat.category} className="bar-row">
              <span className="bar-label">
                <CategoryDot categoryKey={cat.category} /> {cat.category}
              </span>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{
                    width: `${Math.round((cat.hours / maxSummaryHours) * 100)}%`,
                    background: colorOf(cat.category),
                  }}
                />
              </div>
              <span className="bar-value">{formatHours(cat.hours)}</span>
            </div>
          ))}
        {summary.categories.every((c) => c.hours === 0) && (
          <p className="muted-note">Aucune session focus sur cette période.</p>
        )}
      </section>

      <section className="panel">
        <p className="panel-title">Heatmap — heures de focus par jour</p>
        <div className="heatmap-grid">
          {days.map((d) => (
            <div
              key={d.day}
              className={`heatmap-cell lvl-${intensityLevel(d.focusHours, maxFocus)}`}
              title={`${d.day} — ${formatHours(d.focusHours)} de focus`}
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="panel-title">Jours ({days.length})</p>
        <ul className="history-list">
          {antichronological.map((d) => (
            <li key={d.day}>
              <span className="history-day">{d.day}</span>
              <span className="history-tasks">
                {d.tasksDone}/{d.tasksTotal} tâches
              </span>
              <span className="history-focus">{formatHours(d.focusHours)}</span>
              <span className={`history-review${d.hasReview ? ' filled' : ''}`}>
                {d.hasReview ? '✓ bilan' : '— bilan'}
              </span>
              <span className="history-cats">
                {Object.keys(d.hoursByCategory).map((cat) => (
                  <span key={cat} title={`${labelOf(cat)} — ${formatHours(d.hoursByCategory[cat] ?? 0)}`}>
                    <CategoryDot categoryKey={cat} />
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
