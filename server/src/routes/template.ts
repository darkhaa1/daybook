import { Hono } from 'hono';
import { db } from '../db.ts';
import { isActiveCategoryKey } from '../categoriesRepo.ts';
import { assertTimeOrder, readOptionalTime } from '../time.ts';
import { toTemplateItem, type TemplateItemRow } from '../models.ts';
import { badRequest, notFound, parseId, readJson, requireString } from '../http.ts';

export const template = new Hono();

// Triés par heure de début (null en dernier), sort_order en tie-break.
const ORDER = 'ORDER BY (start_time IS NULL), start_time, sort_order';
const listActive = db.prepare(`SELECT * FROM template_items WHERE is_active = 1 ${ORDER}`);
const listAll = db.prepare(`SELECT * FROM template_items ${ORDER}`);
const getById = db.prepare('SELECT * FROM template_items WHERE id = ?');
const maxSortOrder = db.prepare('SELECT MAX(sort_order) as m FROM template_items');
const insertItem = db.prepare(
  `INSERT INTO template_items (text, category, start_time, end_time, day_of_week, sort_order, is_active, created_at)
   VALUES (@text, @category, @start_time, @end_time, @day_of_week, @sort_order, 1, @created_at)`,
);
const deleteItem = db.prepare('DELETE FROM template_items WHERE id = ?');

function validateCategory(value: unknown): string {
  if (typeof value !== 'string' || !isActiveCategoryKey(value)) {
    throw badRequest(`Catégorie invalide ou inactive: ${String(value)}`);
  }
  return value;
}

// Lit day_of_week : undefined si absent, null si explicitement vidé (= tous
// les jours), sinon un entier 0=lundi..6=dimanche.
function readOptionalDayOfWeek(
  body: Record<string, unknown>,
  key: string,
): number | null | undefined {
  if (!(key in body) || body[key] === undefined) return undefined;
  const value = body[key];
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 6) {
    throw badRequest(`${key} invalide (entier 0-6 ou null attendu) : ${String(value)}`);
  }
  return value;
}

// GET /api/template -> actifs triés par heure de début ; ?all=1 inclut inactifs
template.get('/', (c) => {
  const all = c.req.query('all') === '1';
  const rows = (all ? listAll : listActive).all() as TemplateItemRow[];
  return c.json(rows.map(toTemplateItem));
});

// POST /api/template -> { text, category, start_time?, end_time?, day_of_week? }
template.post('/', async (c) => {
  const body = await readJson(c);
  const text = requireString(body, 'text');
  const category = validateCategory(body['category']);
  const start_time = readOptionalTime(body, 'start_time') ?? null;
  const end_time = readOptionalTime(body, 'end_time') ?? null;
  assertTimeOrder(start_time, end_time);
  const day_of_week = readOptionalDayOfWeek(body, 'day_of_week') ?? null;

  const sort_order = ((maxSortOrder.get() as { m: number | null }).m ?? -1) + 1;
  const created_at = new Date().toISOString();
  const info = insertItem.run({
    text,
    category,
    start_time,
    end_time,
    day_of_week,
    sort_order,
    created_at,
  });
  const row = getById.get(info.lastInsertRowid) as TemplateItemRow;
  return c.json(toTemplateItem(row), 201);
});

// PATCH /api/template/:id -> { text?, category?, start_time?, end_time?, day_of_week?, sort_order?, is_active? }
template.patch('/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  const existing = getById.get(id) as TemplateItemRow | undefined;
  if (!existing) throw notFound('Bloc de planning introuvable');

  const body = await readJson(c);
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };

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

  if ('day_of_week' in body && body['day_of_week'] !== undefined) {
    // present & non-undefined => renvoie null (tous les jours) ou l'entier 0-6.
    sets.push('day_of_week = @day_of_week');
    params['day_of_week'] = readOptionalDayOfWeek(body, 'day_of_week') ?? null;
  }

  if ('sort_order' in body && body['sort_order'] !== undefined) {
    const sortOrder = body['sort_order'];
    if (typeof sortOrder !== 'number' || !Number.isInteger(sortOrder) || sortOrder < 0) {
      throw badRequest('sort_order doit être un entier positif ou nul');
    }
    sets.push('sort_order = @sort_order');
    params['sort_order'] = sortOrder;
  }
  if ('is_active' in body && body['is_active'] !== undefined) {
    if (typeof body['is_active'] !== 'boolean') throw badRequest('is_active doit être un booléen');
    sets.push('is_active = @is_active');
    params['is_active'] = body['is_active'] ? 1 : 0;
  }

  if (sets.length === 0) throw badRequest('Aucun champ à mettre à jour');

  db.prepare(`UPDATE template_items SET ${sets.join(', ')} WHERE id = @id`).run(params);
  const row = getById.get(id) as TemplateItemRow;
  return c.json(toTemplateItem(row));
});

// DELETE /api/template/:id -> suppression définitive (le template n'a pas d'historique à préserver)
template.delete('/:id', (c) => {
  const id = parseId(c.req.param('id'));
  const info = deleteItem.run(id);
  if (info.changes === 0) throw notFound('Bloc de planning introuvable');
  return c.json({ ok: true });
});
