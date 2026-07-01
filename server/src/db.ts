import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { SCHEMA_SQL } from './schema.js';

const DB_PATH = process.env.DB_PATH ?? './data/console.db';

// Crée ./data (ou le dossier parent de DB_PATH) si absent.
mkdirSync(dirname(resolve(DB_PATH)), { recursive: true });

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Migration / init au démarrage.
db.exec(SCHEMA_SQL);

console.log(`[db] SQLite prête → ${resolve(DB_PATH)}`);
