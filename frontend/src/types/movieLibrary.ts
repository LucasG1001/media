export type MovieLibraryStatus = "plan_to_watch" | "watched" | "dropped";

export interface MovieLibraryEntry {
  genres?: string[] | null;
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
  syncedAt: string | null;
  notes: string | null;
  watchedAt: string | null;
  lastAccessAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMovieLibraryEntry {
  genres?: string[] | null;
  tmdbId: number;
  title: string;
  posterImage?: string | null;
  status?: MovieLibraryStatus;
  score?: number;
  releaseDate?: string | null;
  runtime?: number | null;
  movieStatus?: string;
}

export interface UpdateMovieLibraryEntry {
  genres?: string[] | null;
  title?: string;
  posterImage?: string | null;
  status?: MovieLibraryStatus;
  score?: number;
  releaseDate?: string | null;
  runtime?: number | null;
  movieStatus?: string;
  notes?: string | null;
}

export const MOVIE_LIBRARY_STATUS_LABELS: Record<MovieLibraryStatus, string> = {
  plan_to_watch: "Planejo Assistir",
  watched: "Assistido",
  dropped: "Abandonado",
};
