import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { SCHEMA_SQL } from './schema.ts';

const DB_PATH = process.env.DB_PATH ?? './data/console.db';

// Crée ./data (ou le dossier parent de DB_PATH) si absent.
mkdirSync(dirname(resolve(DB_PATH)), { recursive: true });

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Migration / init au démarrage.
db.exec(SCHEMA_SQL);

// Ajoute une colonne si absente (bases pré-existantes créées avant son introduction).
function ensureColumn(table: string, column: string, ddl: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((col) => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}
ensureColumn('tasks', 'start_time', 'start_time TEXT');
ensureColumn('tasks', 'end_time', 'end_time TEXT');
// Planning type variable selon le jour de la semaine (bases créées avant son
// introduction) : NULL sur les items existants => comportement inchangé.
ensureColumn('template_items', 'day_of_week', 'day_of_week INTEGER');

// Anti-respawn rétroactif : les jours qui ont déjà des tâches (créés avant
// l'introduction du planning type) sont marqués "déjà appliqués" une seule
// fois, pour que la matérialisation auto ne leur injecte pas le template.
const appliedCount = db
  .prepare('SELECT COUNT(*) as n FROM day_template_applied')
  .get() as { n: number };
if (appliedCount.n === 0) {
  const info = db
    .prepare(
      `INSERT OR IGNORE INTO day_template_applied (day, applied_at)
       SELECT DISTINCT day, @applied_at FROM tasks`,
    )
    .run({ applied_at: new Date().toISOString() });
  if (info.changes > 0) {
    console.log(`[db] ${info.changes} jour(s) existant(s) marqué(s) comme déjà appliqués`);
  }
}

// Seed des catégories historiques — une seule fois, uniquement si la table
// est vide (ne ressuscite pas une catégorie supprimée définitivement).
const CATEGORY_SEED = [
  { key: 'FORM', label: 'Formation TSSR', color: '#E7A23A' },
  { key: 'LAB', label: 'Lab pratique', color: '#5B8DEF' },
  { key: 'CAND', label: 'Candidatures', color: '#DD5B4C' },
  { key: 'PROJ', label: 'Projet tusch.mn', color: '#4CAF7D' },
  { key: 'TRAD', label: 'Trading', color: '#C97BDE' },
  { key: 'CHIEN', label: 'Chiot', color: '#E0C34C' },
  { key: 'PERSO', label: 'Perso', color: '#82A0BA' },
] as const;

const categoryCount = db.prepare('SELECT COUNT(*) as n FROM categories').get() as { n: number };
if (categoryCount.n === 0) {
  const insertSeed = db.prepare(
    `INSERT INTO categories (key, label, color, sort_order, is_archived, created_at)
     VALUES (@key, @label, @color, @sort_order, 0, @created_at)`,
  );
  const seedAll = db.transaction((rows: typeof CATEGORY_SEED) => {
    const created_at = new Date().toISOString();
    rows.forEach((row, i) => insertSeed.run({ ...row, sort_order: i, created_at }));
  });
  seedAll(CATEGORY_SEED);
  console.log(`[db] catégories initiales créées (${CATEGORY_SEED.length})`);
}

// Seed du planning type — un exemple modifiable, une seule fois si la table
// est vide (ne ressuscite pas un planning vidé volontairement par l'utilisateur).
const TEMPLATE_SEED = [
  { text: 'Routine matin', category: 'PERSO', start_time: '08:00', end_time: '09:00' },
  { text: 'Formation TSSR', category: 'FORM', start_time: '09:00', end_time: '12:00' },
  { text: 'Pause déjeuner', category: 'PERSO', start_time: '12:00', end_time: '13:00' },
  { text: 'tusch.mn', category: 'PROJ', start_time: '13:00', end_time: '16:00' },
  { text: 'Homelab', category: 'LAB', start_time: '16:00', end_time: '17:00' },
  { text: 'Candidatures', category: 'CAND', start_time: '17:00', end_time: '18:00' },
] as const;

const templateCount = db.prepare('SELECT COUNT(*) as n FROM template_items').get() as { n: number };
if (templateCount.n === 0) {
  const insertTemplateItem = db.prepare(
    `INSERT INTO template_items (text, category, start_time, end_time, sort_order, is_active, created_at)
     VALUES (@text, @category, @start_time, @end_time, @sort_order, 1, @created_at)`,
  );
  const seedTemplate = db.transaction((rows: typeof TEMPLATE_SEED) => {
    const created_at = new Date().toISOString();
    rows.forEach((row, i) => insertTemplateItem.run({ ...row, sort_order: i, created_at }));
  });
  seedTemplate(TEMPLATE_SEED);
  console.log(`[db] planning type initial créé (${TEMPLATE_SEED.length} blocs)`);
}

console.log(`[db] SQLite prête → ${resolve(DB_PATH)}`);
