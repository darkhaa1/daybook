import { Hono } from 'hono';
import { db } from '../db.ts';
import { parseDate } from '../http.ts';
import { applyTemplateToDay, materializeDayIfNeeded } from '../templateRepo.ts';
import {
  toReview,
  toSession,
  toTask,
  type ReviewRow,
  type SessionRow,
  type TaskRow,
} from '../models.ts';

export const day = new Hono();

// Planifiées (start_time non nul) en ordre chrono d'abord, puis non-planifiées en fin.
const tasksByDay = db.prepare(
  'SELECT * FROM tasks WHERE day = ? ORDER BY (start_time IS NULL), start_time, created_at, id',
);
const sessionsByDay = db.prepare('SELECT * FROM focus_sessions WHERE day = ? ORDER BY ended_at, id');
const reviewByDay = db.prepare('SELECT * FROM daily_reviews WHERE day = ?');

// GET /api/day/:date -> { tasks, sessions, review } du jour.
// Matérialise le planning type au premier accès à un jour (garde-fou anti-respawn).
day.get('/:date', (c) => {
  const date = parseDate(c.req.param('date'));

  materializeDayIfNeeded(date);

  const taskRows = tasksByDay.all(date) as TaskRow[];
  const sessionRows = sessionsByDay.all(date) as SessionRow[];
  const reviewRow = reviewByDay.get(date) as ReviewRow | undefined;

  return c.json({
    tasks: taskRows.map(toTask),
    sessions: sessionRows.map(toSession),
    review: reviewRow ? toReview(reviewRow) : null,
  });
});

// POST /api/day/:date/apply-template -> (ré)applique le template au jour (ajout simple).
day.post('/:date/apply-template', (c) => {
  const date = parseDate(c.req.param('date'));
  const applied = applyTemplateToDay(date);
  return c.json({ ok: true, applied });
});
