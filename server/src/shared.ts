// Enum de catégories — SOURCE UNIQUE partagée front/back.
// Le client l'importe via l'alias Vite "@shared" (voir client/vite.config.ts).

export const CATEGORIES = [
  'FORM',
  'LAB',
  'CAND',
  'PROJ',
  'TRAD',
  'CHIEN',
  'PERSO',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  FORM: 'Formation TSSR',
  LAB: 'Lab pratique',
  CAND: 'Candidatures',
  PROJ: 'Projet tusch.mn',
  TRAD: 'Trading',
  CHIEN: 'Chiot',
  PERSO: 'Perso',
};

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}

export const PERIODS = ['weekly', 'monthly'] as const;

export type Period = (typeof PERIODS)[number];

export function isPeriod(value: unknown): value is Period {
  return typeof value === 'string' && (PERIODS as readonly string[]).includes(value);
}
