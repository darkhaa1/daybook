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

console.log(`[db] SQLite prête → ${resolve(DB_PATH)}`);
