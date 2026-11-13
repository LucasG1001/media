import { describe, it, expect, vi, beforeEach } from "vitest";
import { AxiosError } from "axios";
import type { AxiosResponse } from "axios";
import type { MovieLibraryEntry } from "../types/movieLibrary.js";

vi.mock("../models/movieLibraryModel.js", () => ({
  findStaleMovies: vi.fn(),
  updateMovieSyncData: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../models/gameLibraryModel.js", () => ({ findStaleGames: vi.fn(), updateGameSyncData: vi.fn() }));
vi.mock("../models/bookLibraryModel.js", () => ({ findStaleBooks: vi.fn(), updateBookSyncData: vi.fn() }));
vi.mock("../models/tmdbMissingModel.js", () => {
  const store = () => ({ markMissing: vi.fn().mockResolvedValue(undefined), repoint: vi.fn().mockResolvedValue(true) });
  return { movieMissingStore: store(), seriesMissingStore: store() };
});
vi.mock("./tmdbService.js", () => ({
  fetchMovieSyncData: vi.fn(),
  findMovieIdsByImdbId: vi.fn().mockResolvedValue([]),
  searchMovies: vi.fn().mockResolvedValue({ movies: [] }),
}));
vi.mock("./tmdbSeriesService.js", () => ({ findSeriesIdsByImdbId: vi.fn(), searchSeries: vi.fn() }));
vi.mock("./igdbService.js", () => ({ fetchGamesSyncData: vi.fn() }));
vi.mock("./hardcoverService.js", () => ({ fetchBooksSyncData: vi.fn() }));
vi.mock("./notifyService.js", () => ({
  notifyError: vi.fn().mockResolvedValue(undefined),
  notifyTmdbMissing: vi.fn().mockResolvedValue(undefined),
  notifyTmdbRelocated: vi.fn().mockResolvedValue(undefined),
}));

const { refreshStaleMovies } = await import("./releaseLibrarySyncService.js");
const { findStaleMovies, updateMovieSyncData } = await import("../models/movieLibraryModel.js");
const { movieMissingStore } = await import("../models/tmdbMissingModel.js");
const { fetchMovieSyncData } = await import("./tmdbService.js");
const { notifyError, notifyTmdbMissing } = await import("./notifyService.js");

function httpError(status: number): AxiosError {
  return new AxiosError(`Request failed with status code ${status}`, "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data: {},
  } as AxiosResponse);
}

function makeMovie(overrides: Partial<MovieLibraryEntry> = {}): MovieLibraryEntry {
  return {
    id: "1",
    tmdbId: 1127274,
    title: "A Lenda de Aang: O Último Mestre do Ar",
    posterImage: null,
    status: "plan_to_watch",
    score: 0,
    releaseDate: null,
    runtime: 0,
    movieStatus: "UPCOMING",
    collectionId: 1136366,
    genres: ["Animação"],
    isCover: false,
    syncedAt: "2026-11-07T12:45:55Z",
    imdbId: null,
    tmdbMissingAt: null,
    notes: null,
    watchedAt: null,
    lastAccessAt: null,
    createdAt: "2026-07-22T04:10:08Z",
    updatedAt: "2026-07-22T04:10:08Z",
    ...overrides,
  };
}

const fresh = {
  title: "Avatar Aang: O Último Mestre do Ar",
  posterImage: null,
  releaseDate: "2026-07-24",
  runtime: 100,
  movieStatus: "RELEASED",
  genres: ["Animação"],
  imdbId: "tt18259538",
};

describe("refreshStaleMovies", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not report an error when TMDB answers 404 for a removed movie", async () => {
    vi.mocked(findStaleMovies).mockResolvedValue([makeMovie()]);
    vi.mocked(fetchMovieSyncData).mockRejectedValue(httpError(404));

    await refreshStaleMovies();

    expect(notifyError).not.toHaveBeenCalled();
    expect(updateMovieSyncData).not.toHaveBeenCalled();
  });

  it("marks the removed movie as synced so it leaves the stale queue, and warns once", async () => {
    vi.mocked(findStaleMovies).mockResolvedValue([makeMovie()]);
    vi.mocked(fetchMovieSyncData).mockRejectedValue(httpError(404));

    await refreshStaleMovies();

    expect(movieMissingStore.markMissing).toHaveBeenCalledWith(1127274);
    expect(notifyTmdbMissing).toHaveBeenCalledTimes(1);
  });

  it("stays silent on later probes of a movie already known to be missing", async () => {
    vi.mocked(findStaleMovies).mockResolvedValue([makeMovie({ tmdbMissingAt: "2026-11-13T11:16:00Z" })]);
    vi.mocked(fetchMovieSyncData).mockRejectedValue(httpError(404));

    await refreshStaleMovies();

    expect(movieMissingStore.markMissing).toHaveBeenCalledWith(1127274);
    expect(notifyTmdbMissing).not.toHaveBeenCalled();
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("still reports any other failure and leaves the row untouched", async () => {
    vi.mocked(findStaleMovies).mockResolvedValue([makeMovie()]);
    vi.mocked(fetchMovieSyncData).mockRejectedValue(httpError(500));

    await refreshStaleMovies();

    expect(notifyError).toHaveBeenCalledWith("releaseLibrarySyncService.refreshStaleMovies", expect.any(AxiosError), {
      tmdbId: "1127274",
    });
    expect(movieMissingStore.markMissing).not.toHaveBeenCalled();
  });

  it("keeps refreshing the rest of the batch when one movie is gone", async () => {
    vi.mocked(findStaleMovies).mockResolvedValue([makeMovie(), makeMovie({ id: "2", tmdbId: 980431 })]);
    vi.mocked(fetchMovieSyncData).mockImplementation(async (id) => {
      if (id === 1127274) throw httpError(404);
      return fresh;
    });

    await refreshStaleMovies();

    expect(updateMovieSyncData).toHaveBeenCalledTimes(1);
    expect(updateMovieSyncData).toHaveBeenCalledWith(980431, fresh);
  });
});
