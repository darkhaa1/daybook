import { Hono } from 'hono';
import { db } from '../db.js';
import { isCategory, isPeriod } from '../shared.js';
import { toGoal, type GoalRow } from '../models.js';
import { badRequest, notFound, parseId, readJson, requireString } from '../http.js';

export const goals = new Hono();

const listGoals = db.prepare('SELECT * FROM goals ORDER BY created_at, id');
const getGoal = db.prepare('SELECT * FROM goals WHERE id = ?');
const insertGoal = db.prepare(
  `INSERT INTO goals (title, category, period, target_hours, done, created_at)
   VALUES (@title, @category, @period, @target_hours, 0, @created_at)`,
);
const deleteGoal = db.prepare('DELETE FROM goals WHERE id = ?');

// Lecture d'une catégorie nullable depuis un corps de requête.
function readNullableCategory(body: Record<string, unknown>): string | null {
  const value = body['category'];
  if (value === null || value === undefined || value === '') return null;
  if (!isCategory(value)) throw badRequest(`Catégorie invalide: ${String(value)}`);
  return value;
}

// Lecture d'un nombre d'heures cible nullable.
function readNullableTargetHours(body: Record<string, unknown>): number | null {
  const value = body['target_hours'];
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw badRequest('target_hours doit être un nombre positif ou null');
  }
  return value;
}

// GET /api/goals
goals.get('/', (c) => {
  const rows = listGoals.all() as GoalRow[];
  return c.json(rows.map(toGoal));
});

// POST /api/goals
goals.post('/', async (c) => {
  const body = await readJson(c);
  const title = requireString(body, 'title');
  const period = body['period'];
  if (!isPeriod(period)) throw badRequest(`Période invalide (weekly|monthly): ${String(period)}`);
  const category = readNullableCategory(body);
  const target_hours = readNullableTargetHours(body);
  const created_at = new Date().toISOString();

  const info = insertGoal.run({ title, category, period, target_hours, created_at });
  const row = getGoal.get(info.lastInsertRowid) as GoalRow;
  return c.json(toGoal(row), 201);
});

// PATCH /api/goals/:id
goals.patch('/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  const existing = getGoal.get(id) as GoalRow | undefined;
  if (!existing) throw notFound('But introuvable');

  const body = await readJson(c);
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };

  if ('title' in body && body['title'] !== undefined) {
    sets.push('title = @title');
    params['title'] = requireString(body, 'title');
  }
  if ('period' in body && body['period'] !== undefined) {
    if (!isPeriod(body['period'])) throw badRequest('Période invalide (weekly|monthly)');
    sets.push('period = @period');
    params['period'] = body['period'];
  }
  if ('category' in body) {
    sets.push('category = @category');
    params['category'] = readNullableCategory(body);
  }
  if ('target_hours' in body) {
    sets.push('target_hours = @target_hours');
    params['target_hours'] = readNullableTargetHours(body);
  }
  if ('done' in body && body['done'] !== undefined) {
    if (typeof body['done'] !== 'boolean') throw badRequest('done doit être un booléen');
    sets.push('done = @done');
    params['done'] = body['done'] ? 1 : 0;
  }
  if (sets.length === 0) throw badRequest('Aucun champ à mettre à jour');

  db.prepare(`UPDATE goals SET ${sets.join(', ')} WHERE id = @id`).run(params);
  const row = getGoal.get(id) as GoalRow;
  return c.json(toGoal(row));
});

// DELETE /api/goals/:id
goals.delete('/:id', (c) => {
  const id = parseId(c.req.param('id'));
  const info = deleteGoal.run(id);
  if (info.changes === 0) throw notFound('But introuvable');
  return c.json({ ok: true });
});
