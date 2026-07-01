import { db } from './db.ts';

export interface CategoryHours {
  category: string;
  seconds: number;
  hours: number;
}

// Agrège les heures de focus par catégorie sur [start, end] (bornes incluses).
// Inclut : toutes les catégories actives (zéro-remplies) + toute catégorie
// archivée ayant au moins une session dans la période (historique conservé).
const aggregateStmt = db.prepare(`
  SELECT c.key as category, COALESCE(SUM(fs.duration_sec), 0) as seconds
  FROM categories c
  LEFT JOIN focus_sessions fs ON fs.category = c.key AND fs.day BETWEEN @start AND @end
  WHERE c.is_archived = 0
     OR EXISTS (SELECT 1 FROM focus_sessions fs2 WHERE fs2.category = c.key AND fs2.day BETWEEN @start AND @end)
  GROUP BY c.key
  ORDER BY c.sort_order
`);

export function aggregateHoursByCategory(start: string, end: string): CategoryHours[] {
  const rows = aggregateStmt.all({ start, end }) as { category: string; seconds: number }[];
  return rows.map((r) => ({
    category: r.category,
    seconds: r.seconds,
    hours: Math.round((r.seconds / 3600) * 100) / 100,
  }));
}

const existsActiveByKey = db.prepare('SELECT 1 FROM categories WHERE key = ? AND is_archived = 0');

// Catégorie utilisable pour une NOUVELLE entrée (task/session/goal) : doit exister et ne pas être archivée.
export function isActiveCategoryKey(key: string): boolean {
  return existsActiveByKey.get(key) !== undefined;
}
