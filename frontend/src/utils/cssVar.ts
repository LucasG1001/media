// Valor literal de um token do tema. Só para onde `var(--token)` não chega:
// canvas e <input type="color">.
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
