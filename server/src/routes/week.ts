import { Hono } from 'hono';
import { addDays } from '../date.ts';
import { aggregateHoursByCategory } from '../categoriesRepo.ts';
import { parseDate } from '../http.ts';

export const week = new Hono();

// GET /api/week/:startDate -> agrégation heures par catégorie (lundi -> dimanche)
week.get('/:startDate', (c) => {
  const start = parseDate(c.req.param('startDate'));
  const end = addDays(start, 6);

  const categories = aggregateHoursByCategory(start, end);
  const totalSeconds = categories.reduce((sum, cat) => sum + cat.seconds, 0);

  return c.json({ start, end, totalSeconds, categories });
});
