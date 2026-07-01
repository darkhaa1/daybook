import { Hono } from 'hono';
import { db } from '../db.js';
import { optionalString, parseDate, readJson } from '../http.js';
import { toReview, type ReviewRow } from '../models.js';

export const reviews = new Hono();

const upsertReview = db.prepare(
  `INSERT INTO daily_reviews (day, advanced, dragged, updated_at)
   VALUES (@day, @advanced, @dragged, @updated_at)
   ON CONFLICT(day) DO UPDATE SET
     advanced = excluded.advanced,
     dragged = excluded.dragged,
     updated_at = excluded.updated_at`,
);
const getReview = db.prepare('SELECT * FROM daily_reviews WHERE day = ?');

// PUT /api/reviews/:date -> upsert bilan { advanced, dragged }
reviews.put('/:date', async (c) => {
  const day = parseDate(c.req.param('date'));
  const body = await readJson(c);

  const advanced = optionalString(body, 'advanced') ?? '';
  const dragged = optionalString(body, 'dragged') ?? '';
  const updated_at = new Date().toISOString();

  upsertReview.run({ day, advanced, dragged, updated_at });
  const row = getReview.get(day) as ReviewRow;
  return c.json(toReview(row));
});
