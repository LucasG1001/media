import { describe, it, expect } from "vitest";
import { visibleTracks, trackNeighbors, pickInitialTrack, type MusicListOptions } from "./musicList";
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

// A lista da direita é fixa; quem muda é só a música atual dentro dela.
describe("trackNeighbors", () => {
  const entries = [track("c"), track("a"), track("b"), track("d"), track("x", { status: "removed" })];
  const tracks = visibleTracks(entries, base);

  it("devolve a anterior e a próxima na ordem da lista", () => {
    const { previous, next } = trackNeighbors(tracks, "b");
    expect(previous?.videoId).toBe("a");
    expect(next?.videoId).toBe("c");
  });

  it("dá a volta nas pontas", () => {
    expect(trackNeighbors(tracks, "d").next?.videoId).toBe("a");
    expect(trackNeighbors(tracks, "a").previous?.videoId).toBe("d");
  });

  // Link direto para uma música que a aba ou a busca escondem.
  it("fora da lista, a próxima é a primeira e não há anterior", () => {
    const { previous, next } = trackNeighbors(tracks, "x");
    expect(previous).toBeUndefined();
    expect(next?.videoId).toBe("a");
  });

  it("sozinha na lista, não tem vizinha", () => {
    expect(trackNeighbors([track("so")], "so")).toEqual({});
  });

  it("com a lista vazia não há para onde ir", () => {
    expect(trackNeighbors([], "a")).toEqual({ next: undefined });
  });

  it("não altera a lista recebida", () => {
    trackNeighbors(tracks, "b");
    expect(ids(tracks)).toEqual(["a", "b", "c", "d"]);
  });
});

// A música em que a página abre.
describe("pickInitialTrack", () => {
  it("abre na última música tocada", () => {
    const entries = [
      track("a", { lastAccessAt: "2026-01-01T00:00:00Z" }),
      track("b", { lastAccessAt: "2026-11-10T00:00:00Z" }),
      track("c"),
    ];
    expect(pickInitialTrack(entries)?.videoId).toBe("b");
  });

  it("sem nenhuma tocada, abre na primeira em ordem alfabética", () => {
    const entries = [track("1", { title: "zebra" }), track("2", { title: "Água" })];
    expect(pickInitialTrack(entries)?.videoId).toBe("2");
  });

  it("prefere uma curtida a uma removida tocada mais recentemente", () => {
    const entries = [
      track("removida", { status: "removed", lastAccessAt: "2026-11-12T00:00:00Z" }),
      track("curtida", { lastAccessAt: "2020-01-01T00:00:00Z" }),
    ];
    expect(pickInitialTrack(entries)?.videoId).toBe("curtida");
  });

  it("só cai nas removidas quando não há curtida", () => {
    expect(pickInitialTrack([track("r", { status: "removed" })])?.videoId).toBe("r");
  });

  it("não tem música inicial com a biblioteca vazia", () => {
    expect(pickInitialTrack([])).toBeUndefined();
  });
});
