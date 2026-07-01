import { Hono } from 'hono';
import { db } from '../db.ts';
import { badRequest } from '../http.ts';
import { addDays, todayISO } from '../date.ts';
import { aggregateHoursByCategory } from '../categoriesRepo.ts';

export const history = new Hono();

interface TaskAgg {
  day: string;
  total: number;
  doneSum: number;
}
interface SecondsAgg {
  day: string;
  seconds: number;
}
interface CategorySecondsAgg {
  day: string;
  category: string;
  seconds: number;
}
interface ReviewDay {
  day: string;
}

const tasksAgg = db.prepare(
  'SELECT day, COUNT(*) as total, SUM(done) as doneSum FROM tasks WHERE day BETWEEN ? AND ? GROUP BY day',
);
const sessionsAgg = db.prepare(
  'SELECT day, SUM(duration_sec) as seconds FROM focus_sessions WHERE day BETWEEN ? AND ? GROUP BY day',
);
const sessionsByCategoryAgg = db.prepare(
  'SELECT day, category, SUM(duration_sec) as seconds FROM focus_sessions WHERE day BETWEEN ? AND ? GROUP BY day, category',
);
const reviewsFilled = db.prepare(
  "SELECT day FROM daily_reviews WHERE day BETWEEN ? AND ? AND (advanced <> '' OR dragged <> '')",
);

// GET /api/history?days=30
// -> { days: [...] (ordre chronologique croissant), summary: {...} }
history.get('/', (c) => {
  const raw = c.req.query('days');
  const days = raw === undefined ? 30 : Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw badRequest('days doit être un entier entre 1 et 365');
  }

  const end = todayISO();
  const start = addDays(end, -(days - 1));

  const taskRows = tasksAgg.all(start, end) as TaskAgg[];
  const sessionRows = sessionsAgg.all(start, end) as SecondsAgg[];
  const categoryRows = sessionsByCategoryAgg.all(start, end) as CategorySecondsAgg[];
  const reviewRows = reviewsFilled.all(start, end) as ReviewDay[];

  const tasksByDay = new Map(taskRows.map((r) => [r.day, r]));
  const secondsByDay = new Map(sessionRows.map((r) => [r.day, r.seconds]));
  const reviewDays = new Set(reviewRows.map((r) => r.day));

  const categoryByDay = new Map<string, Record<string, number>>();
  for (const row of categoryRows) {
    const bucket = categoryByDay.get(row.day) ?? {};
    bucket[row.category] = Math.round((row.seconds / 3600) * 100) / 100;
    categoryByDay.set(row.day, bucket);
  }

  const dayList: string[] = [];
  for (let i = 0; i < days; i++) dayList.push(addDays(start, i));

  const result = dayList.map((day) => {
    const taskRow = tasksByDay.get(day);
    const seconds = secondsByDay.get(day) ?? 0;
    return {
      day,
      tasksDone: taskRow?.doneSum ?? 0,
      tasksTotal: taskRow?.total ?? 0,
      focusHours: Math.round((seconds / 3600) * 100) / 100,
      hasReview: reviewDays.has(day),
      hoursByCategory: categoryByDay.get(day) ?? {},
    };
  });

  const activeDays = result.filter((d) => d.tasksDone > 0 || d.focusHours > 0 || d.hasReview).length;
  const tasksDone = result.reduce((sum, d) => sum + d.tasksDone, 0);
  const categories = aggregateHoursByCategory(start, end);

  return c.json({
    days: result,
    summary: { start, end, activeDays, tasksDone, categories },
  });
});
