import type { GameLibraryEntry } from "../types/gameLibrary";
import type { GameGroup } from "./gameCollectionGroups";

// A coleção (das que estão na tela) em que o jogo está.
export function findGroupOf(groups: readonly GameGroup[], igdbId: number): GameGroup | undefined {
  return groups.find((group) => group.members.some((member) => member.igdbId === igdbId));
}

// O jogo aberto na visão de detalhe: o escolhido, enquanto a coleção dele
// estiver na tela; senão (nada escolhido ainda, ou o filtro tirou a coleção de
// vista) o primeiro jogo da primeira coleção. Derivado a cada render, sem efeito
// para "consertar" a escolha quando a lista muda.
export function pickWatchEntry(
  groups: readonly GameGroup[],
  chosenIgdbId: number | null
): GameLibraryEntry | undefined {
  if (chosenIgdbId !== null) {
    const chosen = findGroupOf(groups, chosenIgdbId)?.members.find((member) => member.igdbId === chosenIgdbId);
    if (chosen) return chosen;
  }
  return groups[0]?.members[0];
}
