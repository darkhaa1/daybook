import type {
  Category,
  DailyReview,
  DayPayload,
  FocusSession,
  Goal,
  Period,
  Task,
  WeekAggregation,
} from '../types.ts';

// Erreur au shape stable renvoyée par le back : { code, message }.
export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    });
  } catch {
    throw new ApiError('network_error', 'Serveur injoignable');
  }

  if (!res.ok) {
    let code = 'http_error';
    let message = `Erreur ${res.status}`;
    try {
      const body = (await res.json()) as { code?: string; message?: string };
      if (body.code) code = body.code;
      if (body.message) message = body.message;
    } catch {
      /* corps non-JSON, on garde le message par défaut */
    }
    throw new ApiError(code, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function body(data: unknown): RequestInit {
  return { body: JSON.stringify(data) };
}

export const api = {
  // --- Jour ---
  getDay: (date: string) => request<DayPayload>(`/day/${date}`),

  // --- Tâches ---
  createTask: (data: { text: string; category: Category; day: string }) =>
    request<Task>('/tasks', { method: 'POST', ...body(data) }),
  updateTask: (id: number, data: { done?: boolean; text?: string }) =>
    request<Task>(`/tasks/${id}`, { method: 'PATCH', ...body(data) }),
  deleteTask: (id: number) =>
    request<{ ok: true }>(`/tasks/${id}`, { method: 'DELETE' }),

  // --- Sessions focus ---
  createSession: (data: { category: Category; duration_sec: number; day: string }) =>
    request<FocusSession>('/sessions', { method: 'POST', ...body(data) }),

  // --- Semaine ---
  getWeek: (startDate: string) => request<WeekAggregation>(`/week/${startDate}`),

  // --- Bilan ---
  saveReview: (date: string, data: { advanced: string; dragged: string }) =>
    request<DailyReview>(`/reviews/${date}`, { method: 'PUT', ...body(data) }),

  // --- Buts ---
  getGoals: () => request<Goal[]>('/goals'),
  createGoal: (data: {
    title: string;
    category: Category | null;
    period: Period;
    target_hours: number | null;
  }) => request<Goal>('/goals', { method: 'POST', ...body(data) }),
  updateGoal: (
    id: number,
    data: Partial<{
      title: string;
      category: Category | null;
      period: Period;
      target_hours: number | null;
      done: boolean;
    }>,
  ) => request<Goal>(`/goals/${id}`, { method: 'PATCH', ...body(data) }),
  deleteGoal: (id: number) =>
    request<{ ok: true }>(`/goals/${id}`, { method: 'DELETE' }),
};
