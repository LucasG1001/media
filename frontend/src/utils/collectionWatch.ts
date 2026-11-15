interface WatchGroup<M> {
  members: M[];
}

// A coleção (das que estão na tela) em que o item está.
export function findGroupOf<M extends { id: string }, G extends WatchGroup<M>>(
  groups: readonly G[],
  memberId: string
): G | undefined {
  return groups.find((group) => group.members.some((member) => member.id === memberId));
}

// O item aberto na visão de detalhe: o escolhido, enquanto a coleção dele
// estiver na tela; senão (nada escolhido ainda, ou o filtro tirou a coleção de
// vista) o primeiro item da primeira coleção. Derivado a cada render, sem efeito
// para "consertar" a escolha quando a lista muda.
export function pickWatchEntry<M extends { id: string }>(
  groups: readonly WatchGroup<M>[],
  chosenId: string | null
): M | undefined {
  if (chosenId !== null) {
    const chosen = findGroupOf(groups, chosenId)?.members.find((member) => member.id === chosenId);
    if (chosen) return chosen;
  }
  return groups[0]?.members[0];
}

export type StatusTone = "plan" | "done" | "revisit" | "dropped";

// O papel do status na lista, igual para todas as mídias: os nomes mudam
// (watched/beaten, rewatching/replaying), o papel não.
export function statusTone(status: string): StatusTone {
  if (status === "dropped") return "dropped";
  if (status.startsWith("plan_to")) return "plan";
  if (status.endsWith("ing")) return "revisit";
  return "done";
}

// A revisita conta como concluído, como no sync de coleções.
export function isCompleted(status: string): boolean {
  const tone = statusTone(status);
  return tone === "done" || tone === "revisit";
}

// Do primeiro ao último ano dos itens ("2001–2011"); um ano só quando coincidem.
export function yearSpan(years: readonly (number | null)[]): string | null {
  const known = years.filter((year): year is number => year !== null);
  if (known.length === 0) return null;
  const first = Math.min(...known);
  const last = Math.max(...known);
  return first === last ? String(first) : `${first}–${last}`;
}

// Os gêneros mais comuns entre os itens. Empate fica na ordem em que apareceram.
export function topGenres(lists: readonly (readonly string[] | null | undefined)[], limit = 3): string[] {
  const counts = new Map<string, number>();
  for (const list of lists) {
    for (const genre of list ?? []) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([genre]) => genre);
}

export function yearOf(date: string | null | undefined): number | null {
  const year = date ? Number(date.slice(0, 4)) : NaN;
  return Number.isInteger(year) ? year : null;
}

export function episodesLabel(count: number | null | undefined): string | null {
  if (!count) return null;
  return count === 1 ? "1 ep" : `${count} eps`;
}
