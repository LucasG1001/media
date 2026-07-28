export interface WatchProvider {
  name: string;
  logo: string | null;
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
  voteCount: number | null;
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

export interface PageInfo {
  total: number;
  currentPage: number;
  lastPage: number;
  hasNextPage: boolean;
}

export interface SeriesListResponse {
  series: SeriesCard[];
  pageInfo: PageInfo;
}
