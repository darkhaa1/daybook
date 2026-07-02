import type { Category, Period } from './shared.ts';

// --- Lignes brutes SQLite (done stocké en 0/1) ---

export interface TaskRow {
  id: number;
  text: string;
  category: string;
  done: number;
  day: string;
  created_at: string;
  start_time: string | null;
  end_time: string | null;
}

export interface SessionRow {
  id: number;
  category: string;
  duration_sec: number;
  day: string;
  ended_at: string;
}

export interface ReviewRow {
  day: string;
  advanced: string;
  dragged: string;
  updated_at: string;
}

export interface GoalRow {
  id: number;
  title: string;
  category: string | null;
  period: string;
  target_hours: number | null;
  done: number;
  created_at: string;
}

export interface TemplateItemRow {
  id: number;
  text: string;
  category: string;
  start_time: string | null;
  end_time: string | null;
  sort_order: number;
  is_active: number;
  created_at: string;
}

export interface CategoryRow {
  id: number;
  key: string;
  label: string;
  color: string;
  sort_order: number;
  is_archived: number;
  created_at: string;
  // Colonne calculée par la requête (EXISTS corrélé), pas une colonne SQL réelle.
  in_use: number;
}

// --- Modèles API (done en booléen, catégories typées) ---

export interface Task {
  id: number;
  text: string;
  category: Category;
  done: boolean;
  day: string;
  created_at: string;
  start_time: string | null;
  end_time: string | null;
}

export interface FocusSession {
  id: number;
  category: Category;
  duration_sec: number;
  day: string;
  ended_at: string;
}

export interface DailyReview {
  day: string;
  advanced: string;
  dragged: string;
  updated_at: string;
}

export interface Goal {
  id: number;
  title: string;
  category: Category | null;
  period: Period;
  target_hours: number | null;
  done: boolean;
  created_at: string;
}

export interface TemplateItem {
  id: number;
  text: string;
  category: Category;
  start_time: string | null;
  end_time: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface CategoryDef {
  id: number;
  key: string;
  label: string;
  color: string;
  sort_order: number;
  is_archived: boolean;
  in_use: boolean;
  created_at: string;
}

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    text: row.text,
    category: row.category as Category,
    done: row.done === 1,
    day: row.day,
    created_at: row.created_at,
    start_time: row.start_time,
    end_time: row.end_time,
  };
}

export function toSession(row: SessionRow): FocusSession {
  return {
    id: row.id,
    category: row.category as Category,
    duration_sec: row.duration_sec,
    day: row.day,
    ended_at: row.ended_at,
  };
}

export function toReview(row: ReviewRow): DailyReview {
  return {
    day: row.day,
    advanced: row.advanced,
    dragged: row.dragged,
    updated_at: row.updated_at,
  };
}

export function toGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    title: row.title,
    category: row.category as Category | null,
    period: row.period as Period,
    target_hours: row.target_hours,
    done: row.done === 1,
    created_at: row.created_at,
  };
}

export function toTemplateItem(row: TemplateItemRow): TemplateItem {
  return {
    id: row.id,
    text: row.text,
    category: row.category as Category,
    start_time: row.start_time,
    end_time: row.end_time,
    sort_order: row.sort_order,
    is_active: row.is_active === 1,
    created_at: row.created_at,
  };
}

export function toCategoryDef(row: CategoryRow): CategoryDef {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    color: row.color,
    sort_order: row.sort_order,
    is_archived: row.is_archived === 1,
    in_use: row.in_use === 1,
    created_at: row.created_at,
  };
}
