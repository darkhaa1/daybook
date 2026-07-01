import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

// Erreur applicative au shape stable { code, message }.
export class ApiError extends Error {
  code: string;
  status: ContentfulStatusCode;

  constructor(code: string, message: string, status: ContentfulStatusCode = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = 'ApiError';
  }
}

export function badRequest(message: string): ApiError {
  return new ApiError('bad_request', message, 400);
}

export function notFound(message = 'Ressource introuvable'): ApiError {
  return new ApiError('not_found', message, 404);
}

// Handler d'erreur global monté sur l'app Hono.
export function onError(err: Error, c: Context): Response {
  if (err instanceof ApiError) {
    return c.json({ code: err.code, message: err.message }, err.status);
  }
  console.error('[api] erreur non gérée:', err);
  return c.json({ code: 'internal_error', message: 'Erreur interne du serveur' }, 500);
}

// Validation d'un id numérique de route.
export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest(`Id invalide: ${raw}`);
  }
  return id;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Validation d'une date ISO YYYY-MM-DD (et cohérence calendaire).
export function parseDate(raw: string): string {
  if (!DATE_RE.test(raw)) {
    throw badRequest(`Date invalide (attendu YYYY-MM-DD): ${raw}`);
  }
  const [y, m, d] = raw.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw badRequest(`Date inexistante: ${raw}`);
  }
  return raw;
}

// Lecture typée d'un champ texte non vide.
export function requireString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest(`Champ requis manquant ou vide: ${key}`);
  }
  return value.trim();
}

export function optionalString(body: Record<string, unknown>, key: string): string | undefined {
  if (!(key in body) || body[key] === undefined) return undefined;
  const value = body[key];
  if (typeof value !== 'string') {
    throw badRequest(`Champ invalide (chaîne attendue): ${key}`);
  }
  return value;
}

export async function readJson(c: Context): Promise<Record<string, unknown>> {
  try {
    const body = await c.req.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw badRequest('Corps JSON attendu (objet)');
    }
    return body as Record<string, unknown>;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw badRequest('Corps JSON invalide');
  }
}
