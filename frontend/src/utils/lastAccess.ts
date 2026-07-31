// Data do último acesso em linguagem relativa ("há 3 meses"), que é como o dado
// é lido — "faz quanto tempo que não vejo isso". A data exata vai no title.

const DAY = 86400000;

export function formatLastAccess(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";

  const days = Math.floor((Date.now() - parsed.getTime()) / DAY);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;

  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "há 1 mês" : `há ${months} meses`;

  const years = Math.floor(days / 365);
  return years === 1 ? "há 1 ano" : `há ${years} anos`;
}

export function formatLastAccessExact(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface HasLastAccess {
  lastAccessAt?: string | null;
}

// Para a ordenação: nunca acessado vale 0 (o mais antigo possível), então cai no
// fim com "mais recente primeiro" e no começo com "mais antigo primeiro".
export function lastAccessTimeOf(entry: HasLastAccess): number {
  return entry.lastAccessAt ? new Date(entry.lastAccessAt).getTime() : 0;
}

// Último acesso da coleção = o mais recente entre os membros. É derivado, não
// guardado: item que entra numa coleção passa a compor esse máximo e, ao sair,
// volta a valer por si — sem escrita nem sincronização.
export function latestAccess(members: HasLastAccess[]): string | null {
  let best: string | null = null;
  let bestTime = 0;
  for (const m of members) {
    const time = lastAccessTimeOf(m);
    if (time > bestTime) {
      bestTime = time;
      best = m.lastAccessAt ?? null;
    }
  }
  return best;
}

export type LastAccessTone = "never" | "recent" | "old" | "ancient";

const YEAR = 365 * 86400000;

// Faixas dos casos que o filtro por tempo vai usar: 1 ano e 5 anos.
export function lastAccessTone(iso: string | null): LastAccessTone {
  if (!iso) return "never";
  const elapsed = Date.now() - new Date(iso).getTime();
  if (elapsed >= 5 * YEAR) return "ancient";
  if (elapsed >= YEAR) return "old";
  return "recent";
}
