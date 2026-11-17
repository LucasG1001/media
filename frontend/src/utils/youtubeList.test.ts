import { describe, it, expect } from "vitest";
import {
  visibleTracks,
  channelGroups,
  trackNeighbors,
  pickInitialTrack,
  playlistGroups,
  playlistsOfKind,
  shuffleTracks,
  toggleSelection,
  toggleGroupSelection,
  type YoutubeListOptions,
} from "./youtubeList";
import type { YoutubeLibraryEntry, YoutubePlaylist } from "../types/youtubeLibrary";

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

function playlist(name: string, videoIds: string[], patch: Partial<YoutubePlaylist> = {}): YoutubePlaylist {
  return { id: `pl-${name}`, name, kind: "music", itemIds: videoIds.map((id) => `uuid-${id}`), ...patch };
}

describe("playlistsOfKind", () => {
  it("fica só com as playlists da aba, em ordem alfabética", () => {
    const playlists = [playlist("treino", []), playlist("Aulas", [], { kind: "video" }), playlist("Água", [])];
    expect(playlistsOfKind(playlists, "music").map((p) => p.name)).toEqual(["Água", "treino"]);
    expect(playlistsOfKind(playlists, "video").map((p) => p.name)).toEqual(["Aulas"]);
  });
});

describe("playlistGroups", () => {
  const entries = [
    track("a", { title: "Bohemian Rhapsody", channelTitle: "Queen" }),
    track("b", { title: "Imagine", channelTitle: "John Lennon" }),
    track("c", { title: "Zebra" }),
    track("v", { kind: "video", title: "Aula 1" }),
  ];

  // A ordem é a da playlist (ordem de adição), não a alfabética da lista.
  it("mantém os itens na ordem da playlist", () => {
    const groups = playlistGroups([playlist("Mix", ["c", "a", "b"])], entries, "music", "");
    expect(groups).toHaveLength(1);
    expect(ids(groups[0].tracks)).toEqual(["c", "a", "b"]);
  });

  // Um item pode estar em mais de uma playlist.
  it("repete o item em cada playlist que o contém", () => {
    const groups = playlistGroups([playlist("Um", ["a", "b"]), playlist("Dois", ["b"])], entries, "music", "");
    expect(groups.map((g) => [g.name, ids(g.tracks)])).toEqual([
      ["Dois", ["b"]],
      ["Um", ["a", "b"]],
    ]);
  });

  it("mostra só as playlists da aba ativa", () => {
    const playlists = [playlist("Músicas", ["a"]), playlist("Vídeos", ["v"], { kind: "video" })];
    expect(playlistGroups(playlists, entries, "music", "").map((g) => g.name)).toEqual(["Músicas"]);
    expect(playlistGroups(playlists, entries, "video", "").map((g) => g.name)).toEqual(["Vídeos"]);
  });

  // O vínculo fica guardado: restaurar ou mover de volta devolve o item.
  it("esconde o item removido ou movido para a outra aba, sem tirar a playlist de vista", () => {
    const changed = [
      track("a", { status: "removed" }),
      track("b", { kind: "video" }),
      track("c"),
    ];
    const groups = playlistGroups([playlist("Mix", ["a", "b", "c"]), playlist("Só sumidos", ["a", "b"])], changed, "music", "");
    expect(groups.map((g) => [g.name, ids(g.tracks)])).toEqual([
      ["Mix", ["c"]],
      ["Só sumidos", []],
    ]);
  });

  it("ignora vínculo de item que não está mais na biblioteca", () => {
    const groups = playlistGroups([playlist("Mix", ["fantasma", "a"])], entries, "music", "");
    expect(ids(groups[0].tracks)).toEqual(["a"]);
  });

  it("sem busca, mostra a playlist vazia", () => {
    expect(playlistGroups([playlist("Nova", [])], entries, "music", "").map((g) => g.name)).toEqual(["Nova"]);
  });

  it("a busca recorta os itens por título ou canal e esconde a playlist sem nenhum", () => {
    const playlists = [playlist("Rock", ["a", "b"]), playlist("Bichos", ["c"]), playlist("Vazia", [])];
    const groups = playlistGroups(playlists, entries, "music", " lennon ");
    expect(groups.map((g) => [g.name, ids(g.tracks)])).toEqual([["Rock", ["b"]]]);
  });

  it("a busca que casa com o nome da playlist a mostra inteira", () => {
    const playlists = [playlist("Rock clássico", ["a", "b"]), playlist("Bichos", ["c"])];
    const groups = playlistGroups(playlists, entries, "music", "ROCK");
    expect(groups.map((g) => [g.name, ids(g.tracks)])).toEqual([["Rock clássico", ["a", "b"]]]);
  });
});

describe("shuffleTracks", () => {
  const list = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => track(id));

  it("devolve os mesmos itens, sem perder nem repetir", () => {
    expect(ids(shuffleTracks(list, 42)).sort()).toEqual(ids(list));
  });

  // A ordem não pode mudar entre renders: o "próximo" pularia a cada troca.
  it("é estável para a mesma semente", () => {
    expect(ids(shuffleTracks(list, 42))).toEqual(ids(shuffleTracks([...list].reverse(), 42)));
  });

  it("muda com a semente e sai da ordem original", () => {
    const orders = new Set([1, 2, 3, 4, 5].map((seed) => ids(shuffleTracks(list, seed)).join("")));
    expect(orders.size).toBeGreaterThan(1);
    expect(orders.has(ids(list).join(""))).toBe(false);
  });

  // Tirar um item não reembaralha os que ficam.
  it("mantém a ordem relativa dos outros quando um item sai", () => {
    const full = ids(shuffleTracks(list, 7));
    const without = ids(shuffleTracks(list.filter((t) => t.videoId !== "d"), 7));
    expect(without).toEqual(full.filter((id) => id !== "d"));
  });
});

describe("toggleSelection", () => {
  const siblings = ["a", "b", "c", "d", "e"];

  it("liga e desliga o item clicado", () => {
    const on = toggleSelection(new Set(), "b", siblings, null);
    expect([...on]).toEqual(["b"]);
    expect([...toggleSelection(on, "b", siblings, null)]).toEqual([]);
  });

  it("com Shift marca o intervalo entre a âncora e o clicado, nos dois sentidos", () => {
    expect([...toggleSelection(new Set(["b"]), "d", siblings, "b")]).toEqual(["b", "c", "d"]);
    expect([...toggleSelection(new Set(["d"]), "a", siblings, "d")].sort()).toEqual(["a", "b", "c", "d"]);
  });

  // Intervalo só marca: quem já estava marcado no meio continua.
  it("o intervalo não desmarca o que já estava marcado", () => {
    expect([...toggleSelection(new Set(["a", "c"]), "d", siblings, "a")].sort()).toEqual(["a", "b", "c", "d"]);
  });

  // Âncora em outra lista (outro canal, outra playlist): vira clique simples.
  it("sem âncora nesta lista, cai no clique simples", () => {
    expect([...toggleSelection(new Set(["x"]), "c", siblings, "x")].sort()).toEqual(["c", "x"]);
  });
});

describe("toggleGroupSelection", () => {
  it("marca o grupo inteiro e, com todos marcados, desmarca só ele", () => {
    const partial = toggleGroupSelection(new Set(["a", "z"]), ["a", "b"]);
    expect([...partial].sort()).toEqual(["a", "b", "z"]);
    expect([...toggleGroupSelection(partial, ["a", "b"])]).toEqual(["z"]);
  });

  it("grupo vazio não muda nada", () => {
    expect([...toggleGroupSelection(new Set(["a"]), [])]).toEqual(["a"]);
  });
});
