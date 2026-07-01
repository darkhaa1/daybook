import type { Category, Period } from '@shared';

export type { Category, Period };

export interface Task {
  id: number;
  text: string;
  category: Category;
  done: boolean;
  day: string;
  created_at: string;
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
