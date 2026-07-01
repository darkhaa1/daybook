import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CategoryDef } from '../types.ts';
import { api, ApiError } from '../lib/api.ts';

interface CategoriesContextValue {
  active: CategoryDef[];
  all: CategoryDef[];
  loading: boolean;
  error: string | null;
  labelOf: (key: string) => string;
  colorOf: (key: string) => string;
  refresh: () => Promise<void>;
}

const CategoriesContext = createContext<CategoriesContextValue | null>(null);

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [all, setAll] = useState<CategoryDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.getCategories(true);
      setAll([...rows].sort((a, b) => a.sort_order - b.sort_order));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Chargement des catégories impossible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const active = useMemo(() => all.filter((c) => !c.is_archived), [all]);
  const byKey = useMemo(() => new Map(all.map((c) => [c.key, c])), [all]);

  const labelOf = useCallback((key: string) => byKey.get(key)?.label ?? key, [byKey]);
  const colorOf = useCallback((key: string) => byKey.get(key)?.color ?? 'var(--muted)', [byKey]);

  const value = useMemo<CategoriesContextValue>(
    () => ({ active, all, loading, error, labelOf, colorOf, refresh }),
    [active, all, loading, error, labelOf, colorOf, refresh],
  );

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export function useCategories(): CategoriesContextValue {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error('useCategories doit être utilisé sous CategoriesProvider');
  return ctx;
}
