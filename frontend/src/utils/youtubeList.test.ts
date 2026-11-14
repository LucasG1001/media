import { describe, it, expect } from "vitest";
import {
  visibleTracks,
  channelGroups,
  trackNeighbors,
  pickInitialTrack,
  type YoutubeListOptions,
} from "./youtubeList";
import type { YoutubeLibraryEntry } from "../types/youtubeLibrary";

function track(videoId: string, patch: Partial<YoutubeLibraryEntry> = {}): YoutubeLibraryEntry {
  return {
    id: `uuid-${videoId}`,
    videoId,
    title: videoId,
    channelId: null,
    channelTitle: null,
    channelThumbnail: null,
    kind: "music",
    status: "liked",
    viewCount: 0,
    publishedAt: null,
    lastAccessAt: null,
    ...patch,
  } as YoutubeLibraryEntry;
}

const base: YoutubeListOptions = { kind: "music", status: "liked", search: "", sortField: "alpha", sortDir: "asc" };

function ids(list: YoutubeLibraryEntry[]): string[] {
  return list.map((t) => t.videoId);
}

describe("visibleTracks", () => {
  // Músicas e vídeos moram na mesma biblioteca; cada aba mostra um tipo.
  it("mostra só o tipo da aba ativa", () => {
    const entries = [track("m"), track("v", { kind: "video" })];
    expect(ids(visibleTracks(entries, base))).toEqual(["m"]);
    expect(ids(visibleTracks(entries, { ...base, kind: "video" }))).toEqual(["v"]);
  });

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

  // Sem data não é "o mais antigo": vai para o fim na ordem crescente.
  it("ordena por data deixando os sem data no fim da crescente", () => {
    const entries = [
      track("sem"),
      track("nova", { publishedAt: "2024-01-01T00:00:00Z" }),
      track("velha", { publishedAt: "2010-01-01T00:00:00Z" }),
    ];
    expect(ids(visibleTracks(entries, { ...base, sortField: "date" }))).toEqual(["velha", "nova", "sem"]);
  });

  it("mantém ordem estável entre itens sem data", () => {
    const entries = [track("c"), track("a"), track("b")];
    expect(ids(visibleTracks(entries, { ...base, sortField: "date" }))).toEqual(["a", "b", "c"]);
    expect(ids(visibleTracks(entries, { ...base, sortField: "date", sortDir: "desc" }))).toEqual(["a", "b", "c"]);
  });

  it("ordena por visualizações", () => {
    const entries = [track("a", { viewCount: 10 }), track("b", { viewCount: 500 }), track("c", { viewCount: null })];
    expect(ids(visibleTracks(entries, { ...base, sortField: "views", sortDir: "desc" }))).toEqual(["b", "a", "c"]);
  });

  // Nunca tocado vale 0: cai no fim com "mais recente primeiro".
  it("ordena por último acesso com os nunca tocados no fim da decrescente", () => {
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

describe("channelGroups", () => {
  const queen = { channelId: "UCqueen", channelTitle: "Queen Official", channelThumbnail: "queen.jpg" };
  const abba = { channelId: "UCabba", channelTitle: "ABBA" };
  const entries = [
    track("q2", { ...queen, title: "We Will Rock You", viewCount: 300, publishedAt: "2008-01-01T00:00:00Z" }),
    track("a1", { ...abba, title: "Dancing Queen", viewCount: 900, publishedAt: "2020-01-01T00:00:00Z" }),
    track("q1", { ...queen, title: "Bohemian Rhapsody", viewCount: 500, lastAccessAt: "2026-11-01T00:00:00Z" }),
  ];
  const tracks = visibleTracks(entries, base);

  function names(sortField: string, sortDir: "asc" | "desc" = "asc"): string[] {
    return channelGroups(visibleTracks(entries, { ...base, sortField, sortDir }), sortField, sortDir).map(
      (group) => group.name
    );
  }

  it("junta os itens de cada canal, com nome, avatar e contagem", () => {
    const groups = channelGroups(tracks, "alpha", "asc");
    expect(groups.map((g) => [g.name, g.tracks.length])).toEqual([
      ["ABBA", 1],
      ["Queen Official", 2],
    ]);
    expect(groups[1].thumbnail).toBe("queen.jpg");
  });

  // Dentro do canal vale a ordenação normal: os itens ficam como chegaram.
  it("mantém dentro do canal a ordem em que os itens chegaram", () => {
    const groups = channelGroups(tracks, "alpha", "asc");
    expect(ids(groups[1].tracks)).toEqual(["q1", "q2"]);
    const byViews = visibleTracks(entries, { ...base, sortField: "views", sortDir: "desc" });
    expect(ids(channelGroups(byViews, "views", "desc")[1].tracks)).toEqual(["q1", "q2"]);
  });

  it("ordena os canais pelo nome na ordenação alfabética, nos dois sentidos", () => {
    expect(names("alpha")).toEqual(["ABBA", "Queen Official"]);
    expect(names("alpha", "desc")).toEqual(["Queen Official", "ABBA"]);
  });

  // 900 do ABBA contra 300 + 500 do Queen: quem decide é a soma do canal.
  it("ordena os canais pela soma das visualizações", () => {
    expect(names("views", "desc")).toEqual(["ABBA", "Queen Official"]);
    const more = [...entries, track("q3", { ...queen, title: "Under Pressure", viewCount: 200 })];
    const sorted = visibleTracks(more, { ...base, sortField: "views", sortDir: "desc" });
    expect(channelGroups(sorted, "views", "desc").map((g) => g.name)).toEqual(["Queen Official", "ABBA"]);
  });

  it("ordena os canais pela publicação mais recente e pelo acesso mais recente", () => {
    expect(names("date", "desc")).toEqual(["ABBA", "Queen Official"]);
    expect(names("access", "desc")).toEqual(["Queen Official", "ABBA"]);
  });

  // O id é a identidade do canal: dois canais com o mesmo nome não se misturam,
  // e item antigo sem id cai no nome.
  it("agrupa pelo id do canal e cai no nome quando não há id", () => {
    const groups = channelGroups(
      [
        track("x", { channelId: "UC1", channelTitle: "Mesmo Nome" }),
        track("y", { channelId: "UC2", channelTitle: "Mesmo Nome" }),
        track("z", { channelTitle: "Só Nome" }),
        track("w", { channelTitle: "Só Nome" }),
      ],
      "alpha",
      "asc"
    );
    expect(groups.map((g) => g.tracks.length)).toEqual([1, 1, 2]);
  });

  it("junta num grupo só os itens sem canal nenhum", () => {
    const groups = channelGroups([track("a"), track("b")], "alpha", "asc");
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("Canal desconhecido");
  });

  // A busca recorta os itens antes do agrupamento: canal sem item casando some.
  it("só tem os canais com item que passou pela busca", () => {
    const filtered = visibleTracks(entries, { ...base, search: "dancing" });
    expect(channelGroups(filtered, "alpha", "asc").map((g) => g.name)).toEqual(["ABBA"]);
  });

  it("não tem canal com a lista vazia", () => {
    expect(channelGroups([], "alpha", "asc")).toEqual([]);
  });
});

// A lista da direita é fixa; quem muda é só o item atual dentro dela.
describe("trackNeighbors", () => {
  const entries = [track("c"), track("a"), track("b"), track("d"), track("x", { status: "removed" })];
  const tracks = visibleTracks(entries, base);

  it("devolve o anterior e o próximo na ordem da lista", () => {
    const { previous, next } = trackNeighbors(tracks, "b");
    expect(previous?.videoId).toBe("a");
    expect(next?.videoId).toBe("c");
  });

  it("dá a volta nas pontas", () => {
    expect(trackNeighbors(tracks, "d").next?.videoId).toBe("a");
    expect(trackNeighbors(tracks, "a").previous?.videoId).toBe("d");
  });

  // Link direto para um item que a aba ou a busca escondem.
  it("fora da lista, o próximo é o primeiro e não há anterior", () => {
    const { previous, next } = trackNeighbors(tracks, "x");
    expect(previous).toBeUndefined();
    expect(next?.videoId).toBe("a");
  });

  it("sozinho na lista, não tem vizinho", () => {
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

// O item em que a página abre.
describe("pickInitialTrack", () => {
  it("abre no último item tocado, de qualquer tipo", () => {
    const entries = [
      track("a", { lastAccessAt: "2026-01-01T00:00:00Z" }),
      track("b", { kind: "video", lastAccessAt: "2026-11-10T00:00:00Z" }),
      track("c"),
    ];
    expect(pickInitialTrack(entries)?.videoId).toBe("b");
  });

  it("sem nenhum tocado, abre no primeiro em ordem alfabética", () => {
    const entries = [track("1", { title: "zebra" }), track("2", { title: "Água" })];
    expect(pickInitialTrack(entries)?.videoId).toBe("2");
  });

  it("prefere um curtido a um removido tocado mais recentemente", () => {
    const entries = [
      track("removido", { status: "removed", lastAccessAt: "2026-11-12T00:00:00Z" }),
      track("curtido", { lastAccessAt: "2020-01-01T00:00:00Z" }),
    ];
    expect(pickInitialTrack(entries)?.videoId).toBe("curtido");
  });

  it("só cai nos removidos quando não há curtido", () => {
    expect(pickInitialTrack([track("r", { status: "removed" })])?.videoId).toBe("r");
  });

  it("não tem item inicial com a biblioteca vazia", () => {
    expect(pickInitialTrack([])).toBeUndefined();
  });
});
