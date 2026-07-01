import { Hono } from 'hono';
import { db } from '../db.js';
import { CATEGORIES, type Category } from '../shared.js';
import { parseDate } from '../http.js';

export const week = new Hono();

const sumByCategory = db.prepare(
  `SELECT category, SUM(duration_sec) AS seconds
   FROM focus_sessions
   WHERE day >= ? AND day <= ?
   GROUP BY category`,
);

interface SumRow {
  category: string;
  seconds: number;
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

// GET /api/week/:startDate -> agrégation heures par catégorie (lundi -> dimanche)
week.get('/:startDate', (c) => {
  const start = parseDate(c.req.param('startDate'));
  const end = addDays(start, 6);

  const rows = sumByCategory.all(start, end) as SumRow[];
  const secondsByCat = new Map<string, number>();
  for (const row of rows) {
    secondsByCat.set(row.category, row.seconds ?? 0);
  }

  let totalSeconds = 0;
  const categories = CATEGORIES.map((category: Category) => {
    const seconds = secondsByCat.get(category) ?? 0;
    totalSeconds += seconds;
    return {
      category,
      seconds,
      hours: Math.round((seconds / 3600) * 100) / 100,
    };
  });

  return c.json({ start, end, totalSeconds, categories });
});
