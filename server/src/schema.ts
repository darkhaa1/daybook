// Schéma SQL — appliqué au démarrage (idempotent, IF NOT EXISTS).

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tasks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  text       TEXT    NOT NULL,
  category   TEXT    NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,
  day        TEXT    NOT NULL,
  created_at TEXT    NOT NULL,
  start_time TEXT,
  end_time   TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_day ON tasks(day);

CREATE TABLE IF NOT EXISTS focus_sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  category     TEXT    NOT NULL,
  duration_sec INTEGER NOT NULL,
  day          TEXT    NOT NULL,
  ended_at     TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_day ON focus_sessions(day);
CREATE INDEX IF NOT EXISTS idx_sessions_category ON focus_sessions(category);

CREATE TABLE IF NOT EXISTS daily_reviews (
  day        TEXT PRIMARY KEY,
  advanced   TEXT NOT NULL DEFAULT '',
  dragged    TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT    NOT NULL,
  category     TEXT,
  period       TEXT    NOT NULL,
  target_hours REAL,
  done         INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL
);

-- "category" sur tasks/focus_sessions/goals reste une colonne TEXT libre :
-- elle référence categories.key par convention (pas de FK déclarée), afin de
-- ne pas retoucher le schéma/les requêtes existantes. categories.key est
-- immuable après création ; seuls label/color/sort_order/is_archived changent.
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT    NOT NULL UNIQUE,
  label       TEXT    NOT NULL,
  color       TEXT    NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL
);

-- Planning type récurrent, éditable en base (jamais codé en dur). "category"
-- référence categories.key par la même convention que tasks/focus_sessions/goals.
CREATE TABLE IF NOT EXISTS template_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  text       TEXT    NOT NULL,
  category   TEXT    NOT NULL,
  start_time TEXT,
  end_time   TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL
);

-- Garde-fou anti-respawn : un jour n'est matérialisé depuis le template
-- qu'une seule fois (voir server/src/templateRepo.ts).
CREATE TABLE IF NOT EXISTS day_template_applied (
  day        TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
`;
