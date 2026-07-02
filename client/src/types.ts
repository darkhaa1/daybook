import type { Category, Period } from '@shared';

export type { Category, Period };

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

export interface DayPayload {
  tasks: Task[];
  sessions: FocusSession[];
  review: DailyReview | null;
}

export interface WeekCategory {
  category: Category;
  seconds: number;
  hours: number;
}

export interface WeekAggregation {
  start: string;
  end: string;
  totalSeconds: number;
  categories: WeekCategory[];
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
  key: Category;
  label: string;
  color: string;
  sort_order: number;
  is_archived: boolean;
  in_use: boolean;
  created_at: string;
}

export interface HistoryDay {
  day: string;
  tasksDone: number;
  tasksTotal: number;
  focusHours: number;
  hasReview: boolean;
  hoursByCategory: Record<string, number>;
}

export interface HistorySummary {
  start: string;
  end: string;
  activeDays: number;
  tasksDone: number;
  categories: WeekCategory[];
}

export interface HistoryResponse {
  days: HistoryDay[];
  summary: HistorySummary;
}
