import { Hono } from 'hono';
import { db } from '../db.js';
import { isCategory } from '../shared.js';
import { toTask, type TaskRow } from '../models.js';
import { badRequest, notFound, parseDate, parseId, readJson, requireString } from '../http.js';

export const tasks = new Hono();

const insertTask = db.prepare(
  `INSERT INTO tasks (text, category, done, day, created_at)
   VALUES (@text, @category, 0, @day, @created_at)`,
);
const getTask = db.prepare('SELECT * FROM tasks WHERE id = ?');
const deleteTask = db.prepare('DELETE FROM tasks WHERE id = ?');

tasks.post('/', async (c) => {
  const body = await readJson(c);
  const text = requireString(body, 'text');
  const category = body['category'];
  if (!isCategory(category)) {
    throw badRequest(`Catégorie invalide: ${String(category)}`);
  }
  const day = parseDate(requireString(body, 'day'));
  const created_at = new Date().toISOString();

  const info = insertTask.run({ text, category, day, created_at });
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
  if (sets.length === 0) throw badRequest('Aucun champ à mettre à jour (done, text)');

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
