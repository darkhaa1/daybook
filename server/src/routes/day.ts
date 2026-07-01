import { Hono } from 'hono';
import { db } from '../db.js';
import { parseDate } from '../http.js';
import {
  toReview,
  toSession,
  toTask,
  type ReviewRow,
  type SessionRow,
  type TaskRow,
} from '../models.js';

export const day = new Hono();

const tasksByDay = db.prepare('SELECT * FROM tasks WHERE day = ? ORDER BY created_at, id');
const sessionsByDay = db.prepare('SELECT * FROM focus_sessions WHERE day = ? ORDER BY ended_at, id');
const reviewByDay = db.prepare('SELECT * FROM daily_reviews WHERE day = ?');

// GET /api/day/:date -> { tasks, sessions, review }
day.get('/:date', (c) => {
  const date = parseDate(c.req.param('date'));

  const taskRows = tasksByDay.all(date) as TaskRow[];
  const sessionRows = sessionsByDay.all(date) as SessionRow[];
  const reviewRow = reviewByDay.get(date) as ReviewRow | undefined;

  return c.json({
    tasks: taskRows.map(toTask),
    sessions: sessionRows.map(toSession),
    review: reviewRow ? toReview(reviewRow) : null,
  });
});
