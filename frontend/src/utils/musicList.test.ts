import { describe, it, expect } from "vitest";
import { visibleTracks, toMusicGroups, type MusicListOptions } from "./musicList";
import { collectionNav } from "./collectionNav";
import type { MusicLibraryEntry } from "../types/musicLibrary";

function track(videoId: string, patch: Partial<MusicLibraryEntry> = {}): MusicLibraryEntry {
  return {
    id: `uuid-${videoId}`,
    videoId,
    title: videoId,
    channelTitle: null,
    status: "liked",
    viewCount: 0,
    publishedAt: null,
    lastAccessAt: null,
    ...patch,
  } as MusicLibraryEntry;
}

const base: MusicListOptions = { status: "liked", search: "", sortField: "alpha", sortDir: "asc" };

function ids(list: MusicLibraryEntry[]): string[] {
  return list.map((t) => t.videoId);
}

describe("visibleTracks", () => {
  it("mostra só a aba de status ativa", () => {
    const entries = [track("a"), track("b", { status: "removed" })];
    expect(ids(visibleTracks(entries, base))).toEqual(["a"]);
    expect(ids(visibleTracks(entries, { ...base, status: "removed" }))).toEqual(["b"]);
  });

  it("busca por título ou canal, sem diferenciar maiúsculas", () => {
    const entries = [
      track("a", { title: "Bohemian Rhapsody", channelTitle: "Queen Official" }),
      track("b", { title: "Imagine", channelTitle: "John Lennon" }),
    ];
    expect(ids(visibleTracks(entries, { ...base, search: "  RHAPS " }))).toEqual(["a"]);
    expect(ids(visibleTracks(entries, { ...base, search: "lennon" }))).toEqual(["b"]);
  });

  it("ordena alfabeticamente ignorando acento e caixa", () => {
    const entries = [track("1", { title: "zebra" }), track("2", { title: "Água" }), track("3", { title: "bola" })];
    expect(ids(visibleTracks(entries, base))).toEqual(["2", "3", "1"]);
    expect(ids(visibleTracks(entries, { ...base, sortDir: "desc" }))).toEqual(["1", "3", "2"]);
  });

  // Sem data não é "a mais antiga": vai para o fim na ordem crescente.
  it("ordena por data deixando as sem data no fim da crescente", () => {
    const entries = [
      track("sem"),
      track("nova", { publishedAt: "2024-01-01T00:00:00Z" }),
      track("velha", { publishedAt: "2010-01-01T00:00:00Z" }),
    ];
    expect(ids(visibleTracks(entries, { ...base, sortField: "date" }))).toEqual(["velha", "nova", "sem"]);
  });

  it("mantém ordem estável entre músicas sem data", () => {
    const entries = [track("c"), track("a"), track("b")];
    expect(ids(visibleTracks(entries, { ...base, sortField: "date" }))).toEqual(["a", "b", "c"]);
    expect(ids(visibleTracks(entries, { ...base, sortField: "date", sortDir: "desc" }))).toEqual(["a", "b", "c"]);
  });

  it("ordena por visualizações", () => {
    const entries = [track("a", { viewCount: 10 }), track("b", { viewCount: 500 }), track("c", { viewCount: null })];
    expect(ids(visibleTracks(entries, { ...base, sortField: "views", sortDir: "desc" }))).toEqual(["b", "a", "c"]);
  });

  // Nunca aberta vale 0: cai no fim com "mais recente primeiro".
  it("ordena por último acesso com as nunca abertas no fim da decrescente", () => {
    const entries = [
      track("nunca"),
      track("ontem", { lastAccessAt: "2026-11-12T00:00:00Z" }),
      track("antiga", { lastAccessAt: "2020-01-01T00:00:00Z" }),
    ];
    expect(ids(visibleTracks(entries, { ...base, sortField: "access", sortDir: "desc" }))).toEqual([
      "ontem",
      "antiga",
      "nunca",
    ]);
  });

  it("não altera o array recebido", () => {
    const entries = [track("b"), track("a")];
    visibleTracks(entries, base);
    expect(ids(entries)).toEqual(["b", "a"]);
  });
});

describe("toMusicGroups", () => {
  it("vira um grupo de um só por música, na mesma ordem", () => {
    const tracks = [track("a"), track("b")];
    const groups = toMusicGroups(tracks);
    expect(groups.map((g) => g.key)).toEqual(["track-a", "track-b"]);
    expect(groups.every((g) => g.count === 1 && g.members.length === 1)).toBe(true);
    expect(groups[0].representative).toBe(tracks[0]);
  });
});

// Sem coleção, o anterior/próximo do drawer percorre a lista visível inteira.
describe("navegação pela lista visível", () => {
  const entries = [track("c"), track("a"), track("b"), track("x", { status: "removed" })];
  const tracks = visibleTracks(entries, base);

  it("segue a ordem da tela e ignora o que o filtro tirou", () => {
    const nav = collectionNav([{ members: tracks }], (m) => m.videoId === "b");
    expect(nav).toMatchObject({ index: 1, total: 3 });
    expect(nav?.prev?.videoId).toBe("a");
    expect(nav?.next?.videoId).toBe("c");
  });

  it("não tem anterior na primeira nem próximo na última", () => {
    expect(collectionNav([{ members: tracks }], (m) => m.videoId === "a")?.prev).toBeNull();
    expect(collectionNav([{ members: tracks }], (m) => m.videoId === "c")?.next).toBeNull();
  });
});
