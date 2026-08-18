export type SeriesLibraryStatus = "plan_to_watch" | "watched" | "dropped";

export interface SeriesNextAiringEpisode {
  episode: number;
  airingAt: number;
  // Ausente nas linhas gravadas antes da coluna last_aired_episode existir.
  season?: number;
}

// Último episódio já exibido (last_episode_to_air do TMDB). Comparado com o
// nextAiringEpisode, diz se a temporada encerrou.
export interface SeriesLastAiredEpisode {
  season: number;
  episode: number;
  airDate: string;
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
  notes?: string | null;
  // Última vez assistida. Em séries o último acesso é da temporada, não da série.
  lastAccessAt?: string | null;
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
  lastAiredEpisode: SeriesLastAiredEpisode | null;
  syncedAt: string | null;
  lastNotifiedEpisode: number | null;
  seasonList: SeriesSeasonMeta[] | null;
  seasonStates: Record<string, SeriesSeasonState> | null;
  coverSeason: number | null;
  watchedAt: string | null;
  lastAccessAt: string | null;
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
  seasonList?: SeriesSeasonMeta[] | null;
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
  seasonList?: SeriesSeasonMeta[] | null;
}

export interface SeriesLibraryRow {
  id: string;
  tmdb_id: number;
  title: string;
  poster_image: string | null;
  status: SeriesLibraryStatus;
  score: string;
  first_air_date: string | null;
  seasons: number | null;
  episodes: number | null;
  series_status: string;
  air_status: string | null;
  next_airing_episode: SeriesNextAiringEpisode | null;
  last_aired_episode: SeriesLastAiredEpisode | null;
  synced_at: string | null;
  last_notified_episode: number | null;
  season_list: SeriesSeasonMeta[] | null;
  season_states: Record<string, SeriesSeasonState> | null;
  cover_season: number | null;
  watched_at: string | null;
  last_access_at: string | null;
  created_at: string;
  updated_at: string;
}
