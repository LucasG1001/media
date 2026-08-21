// Toda imagem de terceiro passa pelo backend (/api/img), que a guarda em disco.
// É o que faz a biblioteca continuar com capas quando a CDN — ou a internet —
// está fora. Caminho relativo (o /api/game/image dos jogos) já é do backend.
export function proxied(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return url;
  return `/api/img?u=${encodeURIComponent(url)}`;
}
