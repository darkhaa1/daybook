// Génère une clé de catégorie (majuscules, alphanumérique) à partir d'un libellé.
// La clé étant immuable après création, l'utilisateur peut toujours la saisir
// lui-même (utile pour les libellés non-latins, ex. mongol).
export function slugifyKey(label: string): string {
  let stripped = '';
  for (const ch of label.normalize('NFD')) {
    const code = ch.codePointAt(0) ?? 0;
    const isCombiningMark = code >= 0x0300 && code <= 0x036f;
    if (!isCombiningMark) stripped += ch;
  }
  const key = stripped
    .toUpperCase()
    .split('')
    .filter((ch) => (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9'))
    .join('')
    .slice(0, 16);
  return key || 'CAT';
}
