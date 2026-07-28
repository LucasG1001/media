export type SeriesLibraryStatus = "plan_to_watch" | "watched" | "dropped";

export interface SeriesNextAiringEpisode {
  episode: number;
  airingAt: number;
}

export interface SeriesSeasonMeta {
  number: number;
  name: string | null;
  poster: string | null;
  episodeCount: number | null;
  airDate: string | null;
}

export interface SeriesSeasonState {
  status: SeriesLibraryStatus;
  score: number;
  isRewatching: boolean;
}

export interface SeriesLibraryEntry {
  id: string;
  tmdbId: number;
  title: string;
  posterImage: string | null;
  status: SeriesLibraryStatus;
  score: number;
  firstAirDate: string | null;
  seasons: number | null;
  episodes: number | null;
  seriesStatus: string;
  // Status cru do TMDB ("Returning Series"/"Ended"/...); NULL até o primeiro sync.
  airStatus: string | null;
  nextAiringEpisode: SeriesNextAiringEpisode | null;
  syncedAt: string | null;
  isRewatching: boolean;
  seasonList: SeriesSeasonMeta[] | null;
  seasonStates: Record<string, SeriesSeasonState> | null;
  coverSeason: number | null;
  watchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSeriesLibraryEntry {
  tmdbId: number;
  title: string;
  posterImage?: string | null;
  status?: SeriesLibraryStatus;
  score?: number;
  firstAirDate?: string | null;
  seasons?: number | null;
  episodes?: number | null;
  seriesStatus?: string;
}

export interface UpdateSeriesLibraryEntry {
  title?: string;
  posterImage?: string | null;
  status?: SeriesLibraryStatus;
  score?: number;
  firstAirDate?: string | null;
  seasons?: number | null;
  episodes?: number | null;
  seriesStatus?: string;
  isRewatching?: boolean;
}

export const SERIES_LIBRARY_STATUS_LABELS: Record<SeriesLibraryStatus, string> = {
  plan_to_watch: "Planejo Assistir",
  watched: "Assistido",
  dropped: "Abandonado",
};
