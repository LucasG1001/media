import type { AniListNextAiringEpisode, AniListAiredEpisode, AniListExternalLink } from "./anime.js";

export interface LibraryEntry {
  genres: string[] | null;
  id: string;
  anilistId: number;
  title: string;
  coverImage: string | null;
  status: LibraryStatus;
  score: number;
  totalEpisodes: number | null;
  animeStatus: string;
  franchiseId: number | null;
  isCover: boolean;
  format: string | null;
  seasonYear: number | null;
  nextAiringEpisode: AniListNextAiringEpisode | null;
  // Data do último episódio exibido (ISO); null = desconhecida.
  endDate: string | null;
  // Último episódio já exibido; só preenchido enquanto o anime está RELEASING.
  lastAiredEpisode: AniListAiredEpisode | null;
  streamingLinks: AniListExternalLink[];
  syncedAt: string | null;
  notes: string | null;
  watchedAt: string | null;
  lastAccessAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type LibraryStatus = "plan_to_watch" | "watched" | "dropped";

export interface CreateLibraryEntry {
  genres?: string[] | null;
  anilistId: number;
  title: string;
  coverImage?: string | null;
  status?: LibraryStatus;
  score?: number;
  totalEpisodes?: number | null;
  animeStatus?: string;
  format?: string | null;
  seasonYear?: number | null;
  nextAiringEpisode?: AniListNextAiringEpisode | null;
  endDate?: string | null;
  streamingLinks?: AniListExternalLink[];
}

export interface UpdateLibraryEntry {
  genres?: string[] | null;
  title?: string;
  coverImage?: string | null;
  status?: LibraryStatus;
  score?: number;
  totalEpisodes?: number | null;
  animeStatus?: string;
  notes?: string | null;
}

export interface SyncLibraryData {
  genres: string[];
  title: string;
  coverImage: string | null;
  format: string | null;
  totalEpisodes: number | null;
  animeStatus: string;
  seasonYear: number | null;
  nextAiringEpisode: AniListNextAiringEpisode | null;
  endDate: string | null;
  streamingLinks: AniListExternalLink[];
}

export interface LibraryRow {
  genres: string[] | null;
  id: string;
  anilist_id: number;
  title: string;
  cover_image: string | null;
  status: LibraryStatus;
  score: string;
  total_episodes: number | null;
  anime_status: string;
  franchise_id: number | null;
  is_cover: boolean;
  format: string | null;
  season_year: number | null;
  next_airing_episode: AniListNextAiringEpisode | null;
  end_date: string | null;
  last_aired_episode: AniListAiredEpisode | null;
  streaming_links: AniListExternalLink[];
  synced_at: string | null;
  notes: string | null;
  watched_at: string | null;
  last_access_at: string | null;
  created_at: string;
  updated_at: string;
}
