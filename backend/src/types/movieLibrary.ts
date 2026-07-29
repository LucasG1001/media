export type MovieLibraryStatus = "plan_to_watch" | "watched" | "dropped";

export interface MovieLibraryEntry {
  id: string;
  tmdbId: number;
  title: string;
  posterImage: string | null;
  status: MovieLibraryStatus;
  score: number;
  releaseDate: string | null;
  runtime: number | null;
  movieStatus: string;
  collectionId: number | null;
  isCover: boolean;
  isRewatching: boolean;
  syncedAt: string | null;
  notes: string | null;
  watchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMovieLibraryEntry {
  tmdbId: number;
  title: string;
  posterImage?: string | null;
  status?: MovieLibraryStatus;
  score?: number;
  releaseDate?: string | null;
  runtime?: number | null;
  movieStatus?: string;
  collectionId?: number | null;
}

export interface UpdateMovieLibraryEntry {
  title?: string;
  posterImage?: string | null;
  status?: MovieLibraryStatus;
  score?: number;
  releaseDate?: string | null;
  runtime?: number | null;
  movieStatus?: string;
  isRewatching?: boolean;
  notes?: string | null;
}

export interface MovieSyncData {
  title: string;
  posterImage: string | null;
  releaseDate: string | null;
  runtime: number | null;
  movieStatus: string;
}

export interface MovieLibraryRow {
  id: string;
  tmdb_id: number;
  title: string;
  poster_image: string | null;
  status: MovieLibraryStatus;
  score: string;
  release_date: string | null;
  runtime: number | null;
  movie_status: string;
  collection_id: number | null;
  is_cover: boolean;
  is_rewatching: boolean;
  synced_at: string | null;
  notes: string | null;
  watched_at: string | null;
  created_at: string;
  updated_at: string;
}
