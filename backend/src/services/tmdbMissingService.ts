import { movieMissingStore, seriesMissingStore, type TmdbMissingStore } from "../models/tmdbMissingModel.js";
import { findMovieIdsByImdbId, searchMovies } from "./tmdbService.js";
import { findSeriesIdsByImdbId, searchSeries } from "./tmdbSeriesService.js";
import { notifyError, notifyTmdbMissing, notifyTmdbRelocated, type TmdbMediaType } from "./notifyService.js";
import type { MovieLibraryEntry } from "../types/movieLibrary.js";
import type { SeriesLibraryEntry } from "../types/seriesLibrary.js";

export interface MissingEntry {
  tmdbId: number;
  title: string;
  image: string | null;
  date: string | null;
  imdbId: string | null;
  tmdbMissingAt: string | null;
}

export interface Candidate {
  id: number;
  title: string;
  date: string | null;
}

interface MissingAdapter {
  mediaType: TmdbMediaType;
  store: TmdbMissingStore;
  findByImdbId(imdbId: string): Promise<number[]>;
  search(title: string): Promise<Candidate[]>;
}

function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Sem imdb_id a busca por título é só um palpite: exige data idêntica e um
// único resultado, e mesmo assim o chamador apenas avisa — nunca troca o id.
export function pickCandidate(candidates: Candidate[], entry: MissingEntry): Candidate | null {
  if (!entry.date) return null;
  const wanted = normalizeTitle(entry.title);
  const matches = candidates.filter(
    (candidate) =>
      candidate.id !== entry.tmdbId && candidate.date === entry.date && normalizeTitle(candidate.title) === wanted
  );
  return matches.length === 1 ? matches[0] : null;
}

async function searchCandidate(adapter: MissingAdapter, entry: MissingEntry): Promise<Candidate | null> {
  try {
    return pickCandidate(await adapter.search(entry.title), entry);
  } catch (error) {
    await notifyError("tmdbMissingService.searchCandidate", error, { tmdbId: String(entry.tmdbId) });
    return null;
  }
}

// Chamado a cada sondagem que devolve 404: a troca pelo imdb_id é tentada toda
// vez (o id novo pode aparecer depois), o aviso sai só na primeira.
async function resolveMissing(adapter: MissingAdapter, entry: MissingEntry): Promise<void> {
  let conflictId: number | null = null;

  if (entry.imdbId) {
    const ids = (await adapter.findByImdbId(entry.imdbId)).filter((id) => id !== entry.tmdbId);
    if (ids.length === 1) {
      const newId = ids[0];
      if (await adapter.store.repoint(entry.tmdbId, newId)) {
        await notifyTmdbRelocated({
          mediaType: adapter.mediaType,
          title: entry.title,
          image: entry.image,
          oldId: entry.tmdbId,
          newId,
        });
        return;
      }
      conflictId = newId;
    }
  }

  await adapter.store.markMissing(entry.tmdbId);
  if (entry.tmdbMissingAt) return;

  const candidate = conflictId == null ? await searchCandidate(adapter, entry) : null;
  await notifyTmdbMissing({
    mediaType: adapter.mediaType,
    title: entry.title,
    image: entry.image,
    tmdbId: entry.tmdbId,
    candidate,
    conflictId,
  });
}

const movieAdapter: MissingAdapter = {
  mediaType: "filme",
  store: movieMissingStore,
  findByImdbId: findMovieIdsByImdbId,
  search: async (title) =>
    (await searchMovies(title)).movies.map((movie) => ({ id: movie.id, title: movie.title, date: movie.releaseDate })),
};

const seriesAdapter: MissingAdapter = {
  mediaType: "serie",
  store: seriesMissingStore,
  findByImdbId: findSeriesIdsByImdbId,
  search: async (title) =>
    (await searchSeries(title)).series.map((series) => ({
      id: series.id,
      title: series.title,
      date: series.firstAirDate,
    })),
};

export function resolveMissingMovie(entry: MovieLibraryEntry): Promise<void> {
  return resolveMissing(movieAdapter, {
    tmdbId: entry.tmdbId,
    title: entry.title,
    image: entry.posterImage,
    date: entry.releaseDate,
    imdbId: entry.imdbId,
    tmdbMissingAt: entry.tmdbMissingAt,
  });
}

export function resolveMissingSeries(entry: SeriesLibraryEntry): Promise<void> {
  return resolveMissing(seriesAdapter, {
    tmdbId: entry.tmdbId,
    title: entry.title,
    image: entry.posterImage,
    date: entry.firstAirDate,
    imdbId: entry.imdbId,
    tmdbMissingAt: entry.tmdbMissingAt,
  });
}
