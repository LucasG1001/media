import { describe, it, expect } from "vitest";
import { buildRecentReleases, buildRecentEpisodes } from "./recentReleases";
import type { LibraryEntry } from "../types/library";
import type { MovieLibraryEntry } from "../types/movieLibrary";
import type { SeriesLibraryEntry } from "../types/seriesLibrary";
import type { GameLibraryEntry } from "../types/gameLibrary";
import type { BookLibraryEntry } from "../types/bookLibrary";

let seq = 0;

const DAY = 86400000;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString().slice(0, 10);
}

function anime(over: Partial<LibraryEntry> = {}): LibraryEntry {
  seq += 1;
  return {
    id: `uuid-${seq}`,
    anilistId: seq,
    title: `Anime ${seq}`,
    coverImage: null,
    status: "plan_to_watch",
    score: 0,
    totalEpisodes: 12,
    animeStatus: "FINISHED",
    franchiseId: null,
    isCover: false,
    seasonYear: null,
    nextAiringEpisode: null,
    endDate: isoDaysAgo(10),
    lastAiredEpisode: null,
    streamingLinks: [],
    syncedAt: null,
    notes: null,
    watchedAt: null,
    lastAccessAt: null,
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

function movie(over: Partial<MovieLibraryEntry> = {}): MovieLibraryEntry {
  seq += 1;
  return {
    id: `uuid-${seq}`,
    tmdbId: seq,
    title: `Filme ${seq}`,
    posterImage: null,
    status: "plan_to_watch",
    score: 0,
    releaseDate: isoDaysAgo(10),
    runtime: null,
    movieStatus: "RELEASED",
    collectionId: null,
    isCover: false,
    syncedAt: null,
    notes: null,
    watchedAt: null,
    lastAccessAt: null,
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

function series(over: Partial<SeriesLibraryEntry> = {}): SeriesLibraryEntry {
  seq += 1;
  return {
    id: `uuid-${seq}`,
    tmdbId: seq,
    title: `Serie ${seq}`,
    posterImage: null,
    status: "plan_to_watch",
    score: 0,
    firstAirDate: isoDaysAgo(400),
    seasons: 2,
    episodes: 20,
    seriesStatus: "RELEASED",
    airStatus: "Returning Series",
    nextAiringEpisode: null,
    lastAiredEpisode: { season: 2, episode: 10, airDate: isoDaysAgo(5) },
    syncedAt: null,
    seasonList: null,
    seasonStates: null,
    coverSeason: null,
    watchedAt: null,
    lastAccessAt: null,
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

function game(over: Partial<GameLibraryEntry> = {}): GameLibraryEntry {
  seq += 1;
  return {
    id: `uuid-${seq}`,
    igdbId: seq,
    title: `Jogo ${seq}`,
    backgroundImage: null,
    status: "plan_to_play",
    score: 0,
    released: isoDaysAgo(10),
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
    ...over,
  };
}

function book(over: Partial<BookLibraryEntry> = {}): BookLibraryEntry {
  seq += 1;
  return {
    id: `uuid-${seq}`,
    hardcoverId: seq,
    title: `Livro ${seq}`,
    coverImage: null,
    authors: null,
    status: "plan_to_read",
    score: 0,
    publishedDate: isoDaysAgo(10),
    pageCount: null,
    bookStatus: "RELEASED",
    collectionId: null,
    seriesName: null,
    seriesPosition: null,
    isCover: false,
    syncedAt: null,
    notes: null,
    readAt: null,
    lastAccessAt: null,
    releaseNotifiedAt: null,
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

function build(
  over: {
    animes?: LibraryEntry[];
    movies?: MovieLibraryEntry[];
    seriesList?: SeriesLibraryEntry[];
    games?: GameLibraryEntry[];
    books?: BookLibraryEntry[];
  } = {}
) {
  return buildRecentReleases(
    over.animes ?? [],
    over.movies ?? [],
    over.seriesList ?? [],
    over.games ?? [],
    over.books ?? []
  );
}

describe("buildRecentReleases", () => {
  it("inclui so o que ainda falta consumir", () => {
    const items = build({
      movies: [movie({ title: "Pendente" }), movie({ title: "Visto", status: "watched" })],
    });
    expect(items.map((i) => i.title)).toEqual(["Pendente"]);
  });

  it("ignora abandonado", () => {
    expect(build({ games: [game({ status: "dropped" })] })).toEqual([]);
  });

  it("ignora anime que ainda esta lancando", () => {
    expect(build({ animes: [anime({ animeStatus: "RELEASING" })] })).toEqual([]);
  });

  it("ignora anime sem data de fim conhecida", () => {
    expect(build({ animes: [anime({ endDate: null })] })).toEqual([]);
  });

  it("ignora lancamento futuro", () => {
    const future = new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10);
    expect(build({ movies: [movie({ releaseDate: future })] })).toEqual([]);
  });

  it("ordena do mais recente para o mais antigo", () => {
    const items = build({
      movies: [
        movie({ title: "Antigo", releaseDate: isoDaysAgo(40) }),
        movie({ title: "Novo", releaseDate: isoDaysAgo(2) }),
      ],
    });
    expect(items.map((i) => i.title)).toEqual(["Novo", "Antigo"]);
  });

  it("mantem o minimo de itens mesmo fora da janela de 90 dias", () => {
    const antigos = Array.from({ length: 3 }, (_, n) =>
      movie({ title: `Antigo ${n}`, releaseDate: isoDaysAgo(500 + n) })
    );
    expect(build({ movies: antigos })).toHaveLength(3);
  });

  it("descarta o que esta fora da janela quando ja ha itens recentes de sobra", () => {
    const recentes = Array.from({ length: 10 }, (_, n) =>
      movie({ title: `Recente ${n}`, releaseDate: isoDaysAgo(n + 1) })
    );
    const items = build({
      movies: [...recentes, movie({ title: "Antigo", releaseDate: isoDaysAgo(500) })],
    });
    expect(items).toHaveLength(10);
    expect(items.some((i) => i.title === "Antigo")).toBe(false);
  });

  describe("series", () => {
    it("marca a temporada encerrada quando nao ha proximo episodio", () => {
      const items = build({ seriesList: [series()] });
      expect(items).toHaveLength(1);
      expect(items[0].seasonNumber).toBe(2);
      expect(items[0].detail).toBe("Temporada 2 completa");
    });

    it("marca encerrada quando o proximo episodio ja e da temporada seguinte", () => {
      const entry = series({ nextAiringEpisode: { episode: 1, airingAt: 0, season: 3 } });
      expect(build({ seriesList: [entry] })[0].seasonNumber).toBe(2);
    });

    it("nao marca temporada ainda em exibicao", () => {
      const entry = series({ nextAiringEpisode: { episode: 11, airingAt: 0, season: 2 } });
      expect(build({ seriesList: [entry] })).toEqual([]);
    });

    // Linha gravada antes da coluna last_aired_episode existir: sem `season` no
    // proximo episodio, degrada para nenhum item em vez de um item errado.
    it("nao marca temporada quando o proximo episodio nao tem temporada", () => {
      const entry = series({ nextAiringEpisode: { episode: 11, airingAt: 0 } });
      expect(build({ seriesList: [entry] })).toEqual([]);
    });

    it("respeita o status da temporada, nao o da serie", () => {
      const entry = series({ seasonStates: { "2": { status: "watched", score: 0 } } });
      expect(build({ seriesList: [entry] })).toEqual([]);
    });

    it("usa o poster da temporada quando existe", () => {
      const entry = series({
        seasonList: [{ number: 2, name: null, poster: "capa-t2", episodeCount: 10, airDate: null }],
      });
      expect(build({ seriesList: [entry] })[0].poster).toBe("capa-t2");
    });

    it("cai na serie inteira quando nao ha ultimo episodio exibido", () => {
      const entry = series({ lastAiredEpisode: null, airStatus: "Ended" });
      const items = build({ seriesList: [entry] });
      expect(items).toHaveLength(1);
      expect(items[0].seasonNumber).toBeUndefined();
      expect(items[0].detail).toBe("Terminou de lançar");
    });

    it("ignora serie sem ultimo episodio que ainda esta no ar", () => {
      const entry = series({ lastAiredEpisode: null, airStatus: "Returning Series" });
      expect(build({ seriesList: [entry] })).toEqual([]);
    });
  });

  it("nao mistura com o carrossel de episodios", () => {
    // Anime FINISHED e temporada encerrada sao do carrossel de finalizados; nada
    // deles pode vazar para o de episodios.
    expect(buildRecentEpisodes([anime()], [series()])).toEqual([]);
  });

  it("junta as cinco midias", () => {
    const items = build({
      animes: [anime()],
      movies: [movie()],
      seriesList: [series()],
      games: [game()],
      books: [book()],
    });
    expect(items.map((i) => i.media).sort()).toEqual(["anime", "book", "game", "movie", "series"]);
  });
});

describe("buildRecentEpisodes", () => {
  const emExibicao = (over: Partial<LibraryEntry> = {}) =>
    anime({
      animeStatus: "RELEASING",
      lastAiredEpisode: { episode: 7, airingAt: Math.floor((Date.now() - 2 * DAY) / 1000) },
      ...over,
    });

  // Temporada em andamento: ha proximo episodio na mesma temporada.
  const noAr = (over: Partial<SeriesLibraryEntry> = {}) =>
    series({ nextAiringEpisode: { episode: 11, airingAt: 0, season: 2 }, ...over });

  it("mostra o ultimo episodio de anime em exibicao", () => {
    const items = buildRecentEpisodes([emExibicao()], []);
    expect(items).toHaveLength(1);
    expect(items[0].detail).toBe("Ep. 7");
  });

  it("ignora anime que ja terminou de lancar", () => {
    expect(buildRecentEpisodes([emExibicao({ animeStatus: "FINISHED" })], [])).toEqual([]);
  });

  it("ignora anime sem ultimo episodio conhecido", () => {
    expect(buildRecentEpisodes([emExibicao({ lastAiredEpisode: null })], [])).toEqual([]);
  });

  it("ignora abandonado", () => {
    expect(buildRecentEpisodes([emExibicao({ status: "dropped" })], [])).toEqual([]);
  });

  // Diferente do carrossel de finalizados: estar em dia nao esconde episodio novo.
  it("mantem o que ja foi assistido", () => {
    expect(buildRecentEpisodes([emExibicao({ status: "watched" })], [])).toHaveLength(1);
  });

  it("mostra o episodio da temporada em andamento", () => {
    const items = buildRecentEpisodes([], [noAr()]);
    expect(items).toHaveLength(1);
    expect(items[0].detail).toBe("T2 · Ep. 10");
    expect(items[0].seasonNumber).toBe(2);
  });

  it("ignora temporada ja encerrada", () => {
    expect(buildRecentEpisodes([], [series()])).toEqual([]);
  });

  it("ignora temporada abandonada", () => {
    const entry = noAr({ seasonStates: { "2": { status: "dropped", score: 0 } } });
    expect(buildRecentEpisodes([], [entry])).toEqual([]);
  });

  it("ordena do mais recente para o mais antigo", () => {
    const antigo = emExibicao({
      title: "Antigo",
      lastAiredEpisode: { episode: 3, airingAt: Math.floor((Date.now() - 20 * DAY) / 1000) },
    });
    const novo = emExibicao({ title: "Novo" });
    expect(buildRecentEpisodes([antigo, novo], []).map((i) => i.title)).toEqual(["Novo", "Antigo"]);
  });
});
