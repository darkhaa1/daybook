import { db } from './db.ts';
import { weekdayIndex } from './date.ts';
import type { TemplateItemRow } from './models.ts';

// Blocs actifs applicables à un jour donné : ceux valables tous les jours
// (day_of_week IS NULL) OU ceux ciblant précisément le jour de la semaine.
const activeItemsForDayStmt = db.prepare(
  `SELECT * FROM template_items
   WHERE is_active = 1 AND (day_of_week IS NULL OR day_of_week = @dow)
   ORDER BY sort_order`,
);
const insertTaskFromTemplate = db.prepare(
  `INSERT INTO tasks (text, category, done, day, created_at, start_time, end_time)
   VALUES (@text, @category, 0, @day, @created_at, @start_time, @end_time)`,
);
const isDayApplied = db.prepare('SELECT 1 FROM day_template_applied WHERE day = ?');
const markDayApplied = db.prepare(
  'INSERT OR IGNORE INTO day_template_applied (day, applied_at) VALUES (@day, @applied_at)',
);

// Ajout simple des blocs actifs du template comme tâches du jour (pas de
// vérification d'idempotence ici) + marque le jour appliqué s'il ne l'est
// pas déjà. Ne retient que les blocs valables pour le jour de la semaine de
// `day`. Utilisé par le "Réappliquer" explicite ET par la matérialisation
// automatique ci-dessous.
export function applyTemplateToDay(day: string): number {
  const items = activeItemsForDayStmt.all({ dow: weekdayIndex(day) }) as TemplateItemRow[];
  const created_at = new Date().toISOString();

  const run = db.transaction((rows: TemplateItemRow[]) => {
    for (const item of rows) {
      insertTaskFromTemplate.run({
        text: item.text,
        category: item.category,
        day,
        created_at,
        start_time: item.start_time,
        end_time: item.end_time,
      });
    }
    markDayApplied.run({ day, applied_at: created_at });
  });
  run(items);

  return items.length;
}

// Matérialise le template pour `day` UNIQUEMENT s'il ne l'a jamais été —
// c'est le garde-fou anti-respawn : une tâche supprimée/modifiée du jour ne
// revient pas au reload.
export function materializeDayIfNeeded(day: string): boolean {
  if (isDayApplied.get(day)) return false;
  applyTemplateToDay(day);
  return true;
}

// Le jour a-t-il déjà été matérialisé depuis le template ? Lecture seule —
// utilisé par le planner pour signaler les jours "non ouverts" sans les
// matérialiser.
export function isDayMaterialized(day: string): boolean {
  return isDayApplied.get(day) !== undefined;
}
