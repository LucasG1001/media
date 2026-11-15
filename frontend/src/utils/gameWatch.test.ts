import { describe, it, expect } from "vitest";
import { findGroupOf, pickWatchEntry } from "./gameWatch";
import { buildGameCollectionGroups } from "./gameCollectionGroups";
import type { GameLibraryEntry } from "../types/gameLibrary";

function game(igdbId: number, patch: Partial<GameLibraryEntry> = {}): GameLibraryEntry {
  return {
    id: `uuid-${igdbId}`,
    igdbId,
    title: `Jogo ${igdbId}`,
    backgroundImage: null,
    status: "beaten",
    score: 0,
    released: `20${String(igdbId).padStart(2, "0")}-01-01`,
    metacritic: null,
    gameStatus: "RELEASED",
    collectionId: null,
    isCover: false,
    gameModes: null,
    syncedAt: null,
    notes: null,
    finishedAt: null,
    lastAccessAt: null,
    createdAt: "",
    updatedAt: "",
    ...patch,
  };
}

// Uma saga de três (ids 1–3) e um avulso (id 9).
const ENTRIES = [
  game(1, { collectionId: 7 }),
  game(2, { collectionId: 7 }),
  game(3, { collectionId: 7 }),
  game(9),
];
const GROUPS = buildGameCollectionGroups(ENTRIES);

describe("findGroupOf", () => {
  it("acha a coleção do jogo, inclusive a de um item só", () => {
    expect(findGroupOf(GROUPS, 2)?.key).toBe("collection-7");
    expect(findGroupOf(GROUPS, 9)?.key).toBe("single-9");
  });

  it("não acha jogo que não está em nenhuma coleção da tela", () => {
    expect(findGroupOf(GROUPS, 42)).toBeUndefined();
  });
});

describe("pickWatchEntry", () => {
  it("sem escolha, abre o primeiro jogo da primeira coleção", () => {
    expect(pickWatchEntry(GROUPS, null)).toBe(GROUPS[0].members[0]);
  });

  it("abre o jogo escolhido", () => {
    expect(pickWatchEntry(GROUPS, 9)?.igdbId).toBe(9);
    expect(pickWatchEntry(GROUPS, 2)?.igdbId).toBe(2);
  });

  // O filtro pode tirar a coleção do escolhido de vista: a tela não fica órfã.
  it("cai no primeiro da lista quando o escolhido saiu de vista", () => {
    const withoutSingle = GROUPS.filter((group) => group.key !== "single-9");
    expect(pickWatchEntry(withoutSingle, 9)).toBe(withoutSingle[0].members[0]);
  });

  it("não tem o que abrir com a lista vazia", () => {
    expect(pickWatchEntry([], null)).toBeUndefined();
    expect(pickWatchEntry([], 2)).toBeUndefined();
  });
});
