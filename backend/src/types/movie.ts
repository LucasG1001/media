export interface TmdbMovieListItem {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  vote_average: number | null;
  vote_count: number | null;
  overview: string | null;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  official: boolean;
}

export interface TmdbProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
}

export interface TmdbMovieDetail extends TmdbMovieListItem {
  runtime: number | null;
  genres: TmdbGenre[];
  tagline: string | null;
  imdb_id?: string | null;
  belongs_to_collection?: {
    id: number;
    name: string;
    poster_path: string | null;
    backdrop_path: string | null;
  } | null;
  videos?: { results: TmdbVideo[] };
  "watch/providers"?: {
    results: Record<string, { flatrate?: TmdbProvider[] }>;
  };
}

export interface TmdbFindResponse {
  movie_results?: { id: number }[];
  tv_results?: { id: number }[];
}

export interface TmdbCollectionResponse {
  id: number;
  name: string;
  parts: TmdbMovieListItem[];
}

export interface TmdbListResponse {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbMovieListItem[];
}

export interface MoviePageInfo {
  total: number;
  currentPage: number;
  lastPage: number;
  hasNextPage: boolean;
}

export interface WatchProvider {
  name: string;
  logo: string | null;
}

export interface MovieCard {
  id: number;
  title: string;
  posterImage: string;
  backdropImage: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
  overview: string | null;
  movieStatus: string;
}

export interface MovieDetail extends MovieCard {
  runtime: number | null;
  genres: string[];
  tagline: string | null;
  trailerKey: string | null;
  watchProviders: WatchProvider[];
  voteCount: number | null;
}

export interface MovieListResult {
  movies: MovieCard[];
  pageInfo: MoviePageInfo;
}
