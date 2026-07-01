import { Hono } from 'hono';
import { db } from '../db.ts';
import { toCategoryDef, type CategoryRow } from '../models.ts';
import { ApiError, badRequest, notFound, parseId, readJson, requireString } from '../http.ts';

export const categories = new Hono();

const KEY_RE = /^[A-Z0-9_-]{1,32}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// in_use : calculé via EXISTS corrélés, pas une colonne stockée.
const SELECT_BASE = `
  SELECT c.*,
    (EXISTS(SELECT 1 FROM tasks t WHERE t.category = c.key)
     OR EXISTS(SELECT 1 FROM focus_sessions f WHERE f.category = c.key)
     OR EXISTS(SELECT 1 FROM goals g WHERE g.category = c.key)) AS in_use
  FROM categories c
`;

const listAll = db.prepare(`${SELECT_BASE} ORDER BY c.sort_order`);
const listActive = db.prepare(`${SELECT_BASE} WHERE c.is_archived = 0 ORDER BY c.sort_order`);
const getById = db.prepare(`${SELECT_BASE} WHERE c.id = ?`);
const getByKey = db.prepare('SELECT 1 FROM categories WHERE key = ?');
const maxSortOrder = db.prepare('SELECT MAX(sort_order) as m FROM categories');
const insertCategory = db.prepare(
  `INSERT INTO categories (key, label, color, sort_order, is_archived, created_at)
   VALUES (@key, @label, @color, @sort_order, 0, @created_at)`,
);
const countRefs = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM tasks WHERE category = ?) +
    (SELECT COUNT(*) FROM focus_sessions WHERE category = ?) +
    (SELECT COUNT(*) FROM goals WHERE category = ?) AS total
`);
const hardDelete = db.prepare('DELETE FROM categories WHERE id = ?');
const archiveById = db.prepare('UPDATE categories SET is_archived = 1 WHERE id = @id');

function validateColor(raw: string): string {
  if (!HEX_RE.test(raw)) throw badRequest('Couleur invalide (format hex #RRGGBB attendu)');
  return raw;
}

// GET /api/categories -> actives ; ?all=1 inclut archivées
categories.get('/', (c) => {
  const all = c.req.query('all') === '1';
  const rows = (all ? listAll : listActive).all() as CategoryRow[];
  return c.json(rows.map(toCategoryDef));
});

// POST /api/categories -> { key, label, color }
categories.post('/', async (c) => {
  const body = await readJson(c);

  const key = requireString(body, 'key');
  if (!KEY_RE.test(key)) {
    throw badRequest('Clé invalide (majuscules, chiffres, "_" ou "-", 32 caractères max)');
  }
  const label = requireString(body, 'label');
  const color = validateColor(requireString(body, 'color'));

  if (getByKey.get(key)) {
    throw new ApiError('duplicate_key', `Catégorie déjà existante : ${key}`, 409);
  }

  const sort_order = ((maxSortOrder.get() as { m: number | null }).m ?? -1) + 1;
  const created_at = new Date().toISOString();
  const info = insertCategory.run({ key, label, color, sort_order, created_at });
  const row = getById.get(info.lastInsertRowid) as CategoryRow;
  return c.json(toCategoryDef(row), 201);
});

// PATCH /api/categories/:id -> { label?, color?, sort_order?, is_archived? } (key non modifiable)
categories.patch('/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  const existing = getById.get(id) as CategoryRow | undefined;
  if (!existing) throw notFound('Catégorie introuvable');

  const body = await readJson(c);
  if ('key' in body && body['key'] !== undefined && body['key'] !== existing.key) {
    throw badRequest('La clé de catégorie est immuable');
  }

  const sets: string[] = [];
  const params: Record<string, unknown> = { id };

  if ('label' in body && body['label'] !== undefined) {
    sets.push('label = @label');
    params['label'] = requireString(body, 'label');
  }
  if ('color' in body && body['color'] !== undefined) {
    const color = body['color'];
    if (typeof color !== 'string') throw badRequest('color doit être une chaîne');
    sets.push('color = @color');
    params['color'] = validateColor(color);
  }
  if ('sort_order' in body && body['sort_order'] !== undefined) {
    const sortOrder = body['sort_order'];
    if (typeof sortOrder !== 'number' || !Number.isInteger(sortOrder) || sortOrder < 0) {
      throw badRequest('sort_order doit être un entier positif ou nul');
    }
    sets.push('sort_order = @sort_order');
    params['sort_order'] = sortOrder;
  }
  if ('is_archived' in body && body['is_archived'] !== undefined) {
    if (typeof body['is_archived'] !== 'boolean') throw badRequest('is_archived doit être un booléen');
    sets.push('is_archived = @is_archived');
    params['is_archived'] = body['is_archived'] ? 1 : 0;
  }
  if (sets.length === 0) throw badRequest('Aucun champ à mettre à jour (label, color, sort_order, is_archived)');

  db.prepare(`UPDATE categories SET ${sets.join(', ')} WHERE id = @id`).run(params);
  const row = getById.get(id) as CategoryRow;
  return c.json(toCategoryDef(row));
});

// DELETE /api/categories/:id -> archive (défaut) ; hard-delete si ?hard=1 et inutilisée
categories.delete('/:id', (c) => {
  const id = parseId(c.req.param('id'));
  const existing = getById.get(id) as CategoryRow | undefined;
  if (!existing) throw notFound('Catégorie introuvable');

  const hard = c.req.query('hard') === '1';

  if (hard) {
    const refCount = (countRefs.get(existing.key, existing.key, existing.key) as { total: number }).total;
    if (refCount > 0) {
      throw new ApiError(
        'category_in_use',
        `Suppression définitive impossible : catégorie référencée par ${refCount} enregistrement(s).`,
        409,
      );
    }
    hardDelete.run(id);
    return c.json({ ok: true });
  }

  archiveById.run({ id });
  const row = getById.get(id) as CategoryRow;
  return c.json(toCategoryDef(row));
});
