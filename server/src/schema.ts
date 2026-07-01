// Schéma SQL — appliqué au démarrage (idempotent, IF NOT EXISTS).

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tasks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  text       TEXT    NOT NULL,
  category   TEXT    NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,
  day        TEXT    NOT NULL,
  created_at TEXT    NOT NULL
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
`;
