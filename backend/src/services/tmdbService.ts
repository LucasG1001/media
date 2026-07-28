import { cachedRequest } from "../lib/httpClient.js";
import type {
  TmdbMovieListItem,
  TmdbMovieDetail,
  TmdbCollectionResponse,
  TmdbListResponse,
  MovieCard,
  MovieDetail,
  MovieListResult,
  MoviePageInfo,
  WatchProvider,
} from "../types/movie.js";

const TMDB_URL = "https://api.themoviedb.org/3";
const CACHE_TTL_MS = 60 * 60 * 1000;
const IMAGE_BASE = "https://image.tmdb.org/t/p";
const POSTER_SIZE = "w500";
const BACKDROP_SIZE = "w1280";
const LOGO_SIZE = "w92";

function buildImage(path: string | null, size: string): string | null {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

function deriveStatus(releaseDate: string | null): string {
  if (!releaseDate) return "UPCOMING";
  const today = new Date().toISOString().slice(0, 10);
  return releaseDate <= today ? "RELEASED" : "UPCOMING";
}

function toMovieCard(movie: TmdbMovieListItem): MovieCard {
  return {
    id: movie.id,
    title: movie.title,
    posterImage: buildImage(movie.poster_path, POSTER_SIZE) ?? "",
    backdropImage: buildImage(movie.backdrop_path, BACKDROP_SIZE),
    releaseDate: movie.release_date || null,
    voteAverage: movie.vote_average,
    overview: movie.overview || null,
    movieStatus: deriveStatus(movie.release_date || null),
  };
}

function toMovieDetail(movie: TmdbMovieDetail): MovieDetail {
  const trailer = (movie.videos?.results ?? []).find(
    (v) => v.site === "YouTube" && v.type === "Trailer"
  );

  const flatrate = movie["watch/providers"]?.results?.BR?.flatrate ?? [];
  const watchProviders: WatchProvider[] = flatrate.map((p) => ({
    name: p.provider_name,
    logo: buildImage(p.logo_path, LOGO_SIZE),
  }));

  return {
    ...toMovieCard(movie),
    runtime: movie.runtime,
    genres: movie.genres.map((g) => g.name),
    tagline: movie.tagline || null,
    trailerKey: trailer?.key ?? null,
    watchProviders,
    voteCount: movie.vote_count,
  };
}

function toPageInfo(data: TmdbListResponse): MoviePageInfo {
  return {
    total: data.total_results,
    currentPage: data.page,
    lastPage: data.total_pages,
    hasNextPage: data.page < data.total_pages,
  };
}

async function queryTmdb<T>(path: string, params: Record<string, unknown>): Promise<T> {
  return cachedRequest<T>(
    { url: `${TMDB_URL}${path}`, params: { api_key: process.env.TMDB_API_KEY, language: "pt-BR", ...params } },
    CACHE_TTL_MS
  );
}

export async function fetchPopularMovies(year: number, month: number | undefined, page = 1): Promise<MovieListResult> {
  const mm = month ? String(month).padStart(2, "0") : "";
  const gte = month ? `${year}-${mm}-01` : `${year}-01-01`;
  const lte = month ? `${year}-${mm}-${new Date(year, month, 0).getDate()}` : `${year}-12-31`;
  const data = await queryTmdb<TmdbListResponse>("/discover/movie", {
    sort_by: "vote_count.desc",
    "primary_release_date.gte": gte,
    "primary_release_date.lte": lte,
    page,
  });
  return { movies: data.results.map(toMovieCard), pageInfo: toPageInfo(data) };
}

export async function fetchNowPlayingMovies(page = 1): Promise<MovieListResult> {
  const data = await queryTmdb<TmdbListResponse>("/movie/now_playing", { page, region: "BR" });
  return { movies: data.results.map(toMovieCard), pageInfo: toPageInfo(data) };
}

export async function searchMovies(searchQuery: string, page = 1): Promise<MovieListResult> {
  const data = await queryTmdb<TmdbListResponse>("/search/movie", { query: searchQuery, page });
  return { movies: data.results.map(toMovieCard), pageInfo: toPageInfo(data) };
}

export async function fetchMovieById(id: number): Promise<MovieDetail> {
  const data = await queryTmdb<TmdbMovieDetail>(`/movie/${id}`, {
    append_to_response: "videos,watch/providers",
  });
  return toMovieDetail(data);
}

export interface MovieSyncResult {
  title: string;
  posterImage: string | null;
  releaseDate: string | null;
  runtime: number | null;
  movieStatus: string;
}

export async function fetchMovieSyncData(id: number): Promise<MovieSyncResult> {
  const data = await queryTmdb<TmdbMovieDetail>(`/movie/${id}`, {});
  return {
    title: data.title,
    posterImage: buildImage(data.poster_path, POSTER_SIZE),
    releaseDate: data.release_date || null,
    runtime: data.runtime,
    movieStatus: deriveStatus(data.release_date || null),
  };
}

export async function discoverCollection(tmdbId: number): Promise<{ collectionId: number; members: MovieCard[] } | null> {
  const detail = await queryTmdb<TmdbMovieDetail>(`/movie/${tmdbId}`, {});
  const collection = detail.belongs_to_collection;
  if (!collection) return null;

  const data = await queryTmdb<TmdbCollectionResponse>(`/collection/${collection.id}`, {});
  const members = data.parts
    .map(toMovieCard)
    .sort((a, b) => (a.releaseDate ?? "").localeCompare(b.releaseDate ?? ""));

  return { collectionId: collection.id, members };
}
