// SOURCE UNIQUE partagée front/back (le client l'importe via l'alias Vite "@shared").

// Les catégories sont désormais entièrement dynamiques (table `categories` en
// base, gérée depuis l'UI) : ce type documente l'intention (clé de catégorie)
// sans contrainte de valeurs figées. Aucune liste de catégories en dur ici.
export type Category = string;

export const PERIODS = ['weekly', 'monthly'] as const;

export type Period = (typeof PERIODS)[number];

export function isPeriod(value: unknown): value is Period {
  return typeof value === 'string' && (PERIODS as readonly string[]).includes(value);
}
