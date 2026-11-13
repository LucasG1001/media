import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MovieLibraryEntry } from "../types/movieLibrary.js";
import type { SeriesLibraryEntry } from "../types/seriesLibrary.js";

vi.mock("../models/tmdbMissingModel.js", () => {
  const store = () => ({ markMissing: vi.fn().mockResolvedValue(undefined), repoint: vi.fn().mockResolvedValue(true) });
  return { movieMissingStore: store(), seriesMissingStore: store() };
});
vi.mock("./tmdbService.js", () => ({ findMovieIdsByImdbId: vi.fn(), searchMovies: vi.fn() }));
vi.mock("./tmdbSeriesService.js", () => ({ findSeriesIdsByImdbId: vi.fn(), searchSeries: vi.fn() }));
vi.mock("./notifyService.js", () => ({
  notifyError: vi.fn().mockResolvedValue(undefined),
  notifyTmdbMissing: vi.fn().mockResolvedValue(undefined),
  notifyTmdbRelocated: vi.fn().mockResolvedValue(undefined),
}));

const { pickCandidate, resolveMissingMovie, resolveMissingSeries } = await import("./tmdbMissingService.js");
const { movieMissingStore, seriesMissingStore } = await import("../models/tmdbMissingModel.js");
const { findMovieIdsByImdbId, searchMovies } = await import("./tmdbService.js");
const { findSeriesIdsByImdbId } = await import("./tmdbSeriesService.js");
const { notifyError, notifyTmdbMissing, notifyTmdbRelocated } = await import("./notifyService.js");

function makeMovie(overrides: Partial<MovieLibraryEntry> = {}): MovieLibraryEntry {
  return {
    id: "1",
    tmdbId: 100,
    title: "Duna: Parte Dois",
    posterImage: "https://image.tmdb.org/t/p/w500/x.jpg",
    status: "watched",
    score: 9,
    releaseDate: "2024-02-27",
    runtime: 166,
    movieStatus: "RELEASED",
    collectionId: null,
    genres: [],
    isCover: false,
    syncedAt: "2026-01-01T00:00:00Z",
    imdbId: "tt15239678",
    tmdbMissingAt: null,
    notes: null,
    watchedAt: null,
    lastAccessAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function movieResults(movies: { id: number; title: string; releaseDate: string | null }[]) {
  return { movies, pageInfo: { total: movies.length, currentPage: 1, lastPage: 1, hasNextPage: false } } as Awaited<
    ReturnType<typeof searchMovies>
  >;
}

const base = { tmdbId: 100, title: "Duna: Parte Dois", image: null, date: "2024-02-27", imdbId: null, tmdbMissingAt: null };

describe("pickCandidate", () => {
  it("accepts a single result with the same title and date, ignoring accents and punctuation", () => {
    const candidates = [
      { id: 200, title: "duna - parte dois", date: "2024-02-27" },
      { id: 300, title: "Duna", date: "2021-09-15" },
    ];
    expect(pickCandidate(candidates, base)).toEqual(candidates[0]);
  });

  it("rejects a same-title result released on another date", () => {
    expect(pickCandidate([{ id: 200, title: "Duna: Parte Dois", date: "2024-03-01" }], base)).toBeNull();
  });

  it("rejects when two results tie", () => {
    const candidates = [
      { id: 200, title: "Duna: Parte Dois", date: "2024-02-27" },
      { id: 201, title: "Duna: Parte Dois", date: "2024-02-27" },
    ];
    expect(pickCandidate(candidates, base)).toBeNull();
  });

  it("never matches the removed id itself", () => {
    expect(pickCandidate([{ id: 100, title: "Duna: Parte Dois", date: "2024-02-27" }], base)).toBeNull();
  });

  it("gives up when the library row has no date to compare", () => {
    const candidates = [{ id: 200, title: "Duna: Parte Dois", date: null }];
    expect(pickCandidate(candidates, { ...base, date: null })).toBeNull();
  });
});

describe("resolveMissingMovie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(movieMissingStore.repoint).mockResolvedValue(true);
    vi.mocked(searchMovies).mockResolvedValue(movieResults([]));
  });

  it("repoints the row when the IMDb id resolves to a single new TMDB id", async () => {
    vi.mocked(findMovieIdsByImdbId).mockResolvedValue([200]);

    await resolveMissingMovie(makeMovie());

    expect(movieMissingStore.repoint).toHaveBeenCalledWith(100, 200);
    expect(notifyTmdbRelocated).toHaveBeenCalledWith(expect.objectContaining({ mediaType: "filme", oldId: 100, newId: 200 }));
    expect(movieMissingStore.markMissing).not.toHaveBeenCalled();
    expect(notifyTmdbMissing).not.toHaveBeenCalled();
  });

  it("keeps the row and reports the conflict when the new id is already in the library", async () => {
    vi.mocked(findMovieIdsByImdbId).mockResolvedValue([200]);
    vi.mocked(movieMissingStore.repoint).mockResolvedValue(false);

    await resolveMissingMovie(makeMovie());

    expect(movieMissingStore.markMissing).toHaveBeenCalledWith(100);
    expect(notifyTmdbRelocated).not.toHaveBeenCalled();
    expect(notifyTmdbMissing).toHaveBeenCalledWith(expect.objectContaining({ conflictId: 200, candidate: null }));
  });

  it("does not repoint when the IMDb id resolves to more than one TMDB id", async () => {
    vi.mocked(findMovieIdsByImdbId).mockResolvedValue([200, 201]);

    await resolveMissingMovie(makeMovie());

    expect(movieMissingStore.repoint).not.toHaveBeenCalled();
    expect(movieMissingStore.markMissing).toHaveBeenCalledWith(100);
  });

  it("only suggests a title match, never repoints, when there is no IMDb id", async () => {
    vi.mocked(searchMovies).mockResolvedValue(
      movieResults([{ id: 200, title: "Duna: Parte Dois", releaseDate: "2024-02-27" }])
    );

    await resolveMissingMovie(makeMovie({ imdbId: null }));

    expect(findMovieIdsByImdbId).not.toHaveBeenCalled();
    expect(movieMissingStore.repoint).not.toHaveBeenCalled();
    expect(movieMissingStore.markMissing).toHaveBeenCalledWith(100);
    expect(notifyTmdbMissing).toHaveBeenCalledWith(
      expect.objectContaining({ tmdbId: 100, conflictId: null, candidate: expect.objectContaining({ id: 200 }) })
    );
  });

  it("warns without a candidate when nothing matches", async () => {
    await resolveMissingMovie(makeMovie({ imdbId: null }));

    expect(notifyTmdbMissing).toHaveBeenCalledWith(expect.objectContaining({ candidate: null, conflictId: null }));
  });

  it("still warns when the candidate search itself fails", async () => {
    vi.mocked(searchMovies).mockRejectedValue(new Error("TMDB fora do ar"));

    await resolveMissingMovie(makeMovie({ imdbId: null }));

    expect(notifyError).toHaveBeenCalledTimes(1);
    expect(notifyTmdbMissing).toHaveBeenCalledWith(expect.objectContaining({ candidate: null }));
  });

  it("retries the IMDb lookup on later probes but does not warn again", async () => {
    vi.mocked(findMovieIdsByImdbId).mockResolvedValue([]);

    await resolveMissingMovie(makeMovie({ tmdbMissingAt: "2026-11-13T00:00:00Z" }));

    expect(findMovieIdsByImdbId).toHaveBeenCalledWith("tt15239678");
    expect(movieMissingStore.markMissing).toHaveBeenCalledWith(100);
    expect(searchMovies).not.toHaveBeenCalled();
    expect(notifyTmdbMissing).not.toHaveBeenCalled();
  });
});

describe("resolveMissingSeries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("repoints through the series store and the tv lookup", async () => {
    vi.mocked(findSeriesIdsByImdbId).mockResolvedValue([900]);
    vi.mocked(seriesMissingStore.repoint).mockResolvedValue(true);
    const series = {
      tmdbId: 800,
      title: "Ruptura",
      posterImage: null,
      firstAirDate: "2022-02-17",
      imdbId: "tt11280740",
      tmdbMissingAt: null,
    } as SeriesLibraryEntry;

    await resolveMissingSeries(series);

    expect(seriesMissingStore.repoint).toHaveBeenCalledWith(800, 900);
    expect(movieMissingStore.repoint).not.toHaveBeenCalled();
    expect(notifyTmdbRelocated).toHaveBeenCalledWith(expect.objectContaining({ mediaType: "serie", newId: 900 }));
  });
});
