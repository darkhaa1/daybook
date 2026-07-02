import { Hono } from 'hono';
import { db } from '../db.ts';
import { isActiveCategoryKey } from '../categoriesRepo.ts';
import { assertTimeOrder, readOptionalTime } from '../time.ts';
import { toTask, type TaskRow } from '../models.ts';
import { badRequest, notFound, parseDate, parseId, readJson, requireString } from '../http.ts';

export const tasks = new Hono();

const insertTask = db.prepare(
  `INSERT INTO tasks (text, category, done, day, created_at, start_time, end_time)
   VALUES (@text, @category, 0, @day, @created_at, @start_time, @end_time)`,
);
const getTask = db.prepare('SELECT * FROM tasks WHERE id = ?');
const deleteTask = db.prepare('DELETE FROM tasks WHERE id = ?');

function validateCategory(value: unknown): string {
  if (typeof value !== 'string' || !isActiveCategoryKey(value)) {
    throw badRequest(`Catégorie invalide ou inactive: ${String(value)}`);
  }
  return value;
}

tasks.post('/', async (c) => {
  const body = await readJson(c);
  const text = requireString(body, 'text');
  const category = validateCategory(body['category']);
  const day = parseDate(requireString(body, 'day'));
  const start_time = readOptionalTime(body, 'start_time') ?? null;
  const end_time = readOptionalTime(body, 'end_time') ?? null;
  assertTimeOrder(start_time, end_time);
  const created_at = new Date().toISOString();

  const info = insertTask.run({ text, category, day, created_at, start_time, end_time });
  const row = getTask.get(info.lastInsertRowid) as TaskRow;
  return c.json(toTask(row), 201);
});

tasks.patch('/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  const existing = getTask.get(id) as TaskRow | undefined;
  if (!existing) throw notFound('Tâche introuvable');

  const body = await readJson(c);
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };

  if ('done' in body && body['done'] !== undefined) {
    if (typeof body['done'] !== 'boolean') throw badRequest('done doit être un booléen');
    sets.push('done = @done');
    params['done'] = body['done'] ? 1 : 0;
  }
  if ('text' in body && body['text'] !== undefined) {
    sets.push('text = @text');
    params['text'] = requireString(body, 'text');
  }
  if ('category' in body && body['category'] !== undefined) {
    sets.push('category = @category');
    params['category'] = validateCategory(body['category']);
  }

  const startProvided = 'start_time' in body && body['start_time'] !== undefined;
  const endProvided = 'end_time' in body && body['end_time'] !== undefined;
  if (startProvided || endProvided) {
    const newStart = startProvided ? (readOptionalTime(body, 'start_time') ?? null) : existing.start_time;
    const newEnd = endProvided ? (readOptionalTime(body, 'end_time') ?? null) : existing.end_time;
    assertTimeOrder(newStart, newEnd);
    if (startProvided) {
      sets.push('start_time = @start_time');
      params['start_time'] = newStart;
    }
    if (endProvided) {
      sets.push('end_time = @end_time');
      params['end_time'] = newEnd;
    }
  }

  if (sets.length === 0) {
    throw badRequest('Aucun champ à mettre à jour (done, text, category, start_time, end_time)');
  }

  db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = @id`).run(params);
  const row = getTask.get(id) as TaskRow;
  return c.json(toTask(row));
});

tasks.delete('/:id', (c) => {
  const id = parseId(c.req.param('id'));
  const info = deleteTask.run(id);
  if (info.changes === 0) throw notFound('Tâche introuvable');
  return c.json({ ok: true });
});
