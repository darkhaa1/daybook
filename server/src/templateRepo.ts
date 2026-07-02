import { db } from './db.ts';
import type { TemplateItemRow } from './models.ts';

const activeItemsStmt = db.prepare('SELECT * FROM template_items WHERE is_active = 1 ORDER BY sort_order');
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
// pas déjà. Utilisé par le "Réappliquer" explicite ET par la matérialisation
// automatique ci-dessous.
export function applyTemplateToDay(day: string): number {
  const items = activeItemsStmt.all() as TemplateItemRow[];
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
