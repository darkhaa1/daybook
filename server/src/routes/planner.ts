import { Hono } from 'hono';
import { db } from '../db.ts';
import { addDays, weekdayIndex } from '../date.ts';
import { badRequest, parseDate } from '../http.ts';
import { isDayMaterialized } from '../templateRepo.ts';
import { toTask, type TaskRow } from '../models.ts';

export const planner = new Hono();

// Même tri que la vue jour : planifiées (start_time non nul) en ordre chrono,
// puis non-planifiées en fin.
const tasksByDay = db.prepare(
  'SELECT * FROM tasks WHERE day = ? ORDER BY (start_time IS NULL), start_time, created_at, id',
);

// GET /api/planner/:startDate -> semaine lundi->dimanche à partir de startDate.
// LECTURE SEULE : ne matérialise AUCUN jour. isApplied signale les jours non
// encore ouverts (template pas appliqué) ; tasks reflète les tâches réelles en
// base (matérialisées et/ou manuelles), vide pour un jour non ouvert & sans
// tâche manuelle.
planner.get('/:startDate', (c) => {
  const start = parseDate(c.req.param('startDate'));
  if (weekdayIndex(start) !== 0) {
    throw badRequest(`startDate doit être un lundi (YYYY-MM-DD) : ${start}`);
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i);
    const taskRows = tasksByDay.all(day) as TaskRow[];
    return {
      day,
      tasks: taskRows.map(toTask),
      isApplied: isDayMaterialized(day),
    };
  });

  return c.json({ start, days });
});
