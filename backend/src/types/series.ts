export interface TmdbTvListItem {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
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

export interface TmdbSeason {
  season_number: number;
  name: string | null;
  poster_path: string | null;
  episode_count: number | null;
  air_date: string | null;
}

export interface TmdbEpisode {
  air_date: string | null;
  episode_number: number;
  season_number: number;
  name: string | null;
}

export interface TmdbSeasonEpisode {
  episode_number: number;
  name: string | null;
  overview: string | null;
  air_date: string | null;
  runtime: number | null;
  still_path: string | null;
  vote_average: number | null;
}

export interface TmdbSeasonDetail {
  season_number: number;
  name: string | null;
  overview: string | null;
  poster_path: string | null;
  air_date: string | null;
  episodes: TmdbSeasonEpisode[];
}

export interface TmdbTvDetail extends TmdbTvListItem {
  number_of_seasons: number | null;
  number_of_episodes: number | null;
  seasons?: TmdbSeason[];
  episode_run_time: number[];
  genres: TmdbGenre[];
  tagline: string | null;
  status: string | null;
  next_episode_to_air?: TmdbEpisode | null;
  last_episode_to_air?: TmdbEpisode | null;
  videos?: { results: TmdbVideo[] };
  "watch/providers"?: {
    results: Record<string, { flatrate?: TmdbProvider[] }>;
  };
}

export interface TmdbListResponse {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbTvListItem[];
}

export interface SeriesPageInfo {
  total: number;
  currentPage: number;
  lastPage: number;
  hasNextPage: boolean;
}

export interface WatchProvider {
  name: string;
  logo: string | null;
}

export interface SeasonMeta {
  number: number;
  name: string | null;
  poster: string | null;
  episodeCount: number | null;
  airDate: string | null;
}

export interface SeasonEpisode {
  episodeNumber: number;
  name: string | null;
  overview: string | null;
  airDate: string | null;
  runtime: number | null;
  still: string | null;
  voteAverage: number | null;
}

export interface SeasonDetail {
  seasonNumber: number;
  name: string | null;
  overview: string | null;
  poster: string | null;
  airDate: string | null;
  episodeCount: number;
  episodes: SeasonEpisode[];
}

export interface SeriesCard {
  id: number;
  title: string;
  posterImage: string;
  backdropImage: string | null;
  firstAirDate: string | null;
  voteAverage: number | null;
  overview: string | null;
  seriesStatus: string;
}

export interface SeriesDetail extends SeriesCard {
  seasons: number | null;
  episodes: number | null;
  genres: string[];
  tagline: string | null;
  airStatus: string | null;
  trailerKey: string | null;
  watchProviders: WatchProvider[];
  seasonList: SeasonMeta[];
  voteCount: number | null;
}

export interface SeriesListResult {
  series: SeriesCard[];
  pageInfo: SeriesPageInfo;
}
