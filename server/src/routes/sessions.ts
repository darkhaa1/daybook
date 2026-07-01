import { Hono } from 'hono';
import { db } from '../db.js';
import { isCategory } from '../shared.js';
import { toSession, type SessionRow } from '../models.js';
import { badRequest, parseDate, readJson } from '../http.js';

export const sessions = new Hono();

const insertSession = db.prepare(
  `INSERT INTO focus_sessions (category, duration_sec, day, ended_at)
   VALUES (@category, @duration_sec, @day, @ended_at)`,
);
const getSession = db.prepare('SELECT * FROM focus_sessions WHERE id = ?');

// POST /api/sessions -> enregistre une session focus terminée
sessions.post('/', async (c) => {
  const body = await readJson(c);

  const category = body['category'];
  if (!isCategory(category)) {
    throw badRequest(`Catégorie invalide: ${String(category)}`);
  }

  const duration = body['duration_sec'];
  if (typeof duration !== 'number' || !Number.isInteger(duration) || duration <= 0) {
    throw badRequest('duration_sec doit être un entier positif');
  }

  const day = parseDate(typeof body['day'] === 'string' ? body['day'] : '');
  const ended_at = new Date().toISOString();

  const info = insertSession.run({ category, duration_sec: duration, day, ended_at });
  const row = getSession.get(info.lastInsertRowid) as SessionRow;
  return c.json(toSession(row), 201);
});
