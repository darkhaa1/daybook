import { badRequest } from './http.ts';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_RE.test(value);
}

// Lit un champ heure optionnel (HH:MM) depuis le corps de requête.
// Retourne undefined si le champ est absent (non fourni), null si explicitement vidé.
export function readOptionalTime(body: Record<string, unknown>, key: string): string | null | undefined {
  if (!(key in body) || body[key] === undefined) return undefined;
  const value = body[key];
  if (value === null || value === '') return null;
  if (!isValidTime(value)) {
    throw badRequest(`${key} invalide (format HH:MM attendu) : ${String(value)}`);
  }
  return value;
}

// Comparaison lexicographique valide car HH:MM est à largeur fixe.
export function assertTimeOrder(start: string | null, end: string | null): void {
  if (start && end && end < start) {
    throw badRequest('end_time doit être postérieur ou égal à start_time');
  }
}
