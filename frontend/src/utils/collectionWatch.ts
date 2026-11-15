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
