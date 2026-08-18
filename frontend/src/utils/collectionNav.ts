export interface CollectionNav<T> {
  index: number;
  total: number;
  prev: T | null;
  next: T | null;
}

// Vizinhos de um item dentro da coleção a que ele pertence, para navegar sem
// fechar o drawer. A sequência é a **que está na tela**: os grupos já chegam
// filtrados e ordenados pelo pipeline da página, e `membersOf` cobre o caso em
// que a expansão reduz ainda mais (o filtro de tag do YouTube).
//
// Devolve null quando o item não está em coleção nenhuma (veio do catálogo) ou
// quando a coleção tem um item só — aí não há para onde navegar.
// O tipo do membro sai do próprio grupo (`G["members"][number]`), senão o TS não
// consegue inferir os dois parâmetros a partir só do array de grupos.
export function collectionNav<G extends { members: unknown[] }>(
  groups: readonly G[],
  isCurrent: (member: G["members"][number]) => boolean,
  membersOf: (group: G) => G["members"] = (group) => group.members
): CollectionNav<G["members"][number]> | null {
  const group = groups.find((g) => g.members.some(isCurrent));
  if (!group) return null;
  const list = membersOf(group);
  const index = list.findIndex(isCurrent);
  if (index === -1 || list.length < 2) return null;
  return {
    index,
    total: list.length,
    prev: list[index - 1] ?? null,
    next: list[index + 1] ?? null,
  };
}
