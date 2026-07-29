import type { AniListNextAiringEpisode, AniListExternalLink } from "./anime.js";

export interface LibraryEntry {
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
  isRewatching: boolean;
  format: string | null;
  seasonYear: number | null;
  nextAiringEpisode: AniListNextAiringEpisode | null;
  streamingLinks: AniListExternalLink[];
  syncedAt: string | null;
  notes: string | null;
  watchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type LibraryStatus = "plan_to_watch" | "watched" | "dropped";

export interface CreateLibraryEntry {
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
  streamingLinks?: AniListExternalLink[];
}

export interface UpdateLibraryEntry {
  title?: string;
  coverImage?: string | null;
  status?: LibraryStatus;
  score?: number;
  totalEpisodes?: number | null;
  animeStatus?: string;
  isRewatching?: boolean;
  notes?: string | null;
}

export interface SyncLibraryData {
  title: string;
  coverImage: string | null;
  format: string | null;
  totalEpisodes: number | null;
  animeStatus: string;
  seasonYear: number | null;
  nextAiringEpisode: AniListNextAiringEpisode | null;
  streamingLinks: AniListExternalLink[];
}

export interface LibraryRow {
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
  is_rewatching: boolean;
  format: string | null;
  season_year: number | null;
  next_airing_episode: AniListNextAiringEpisode | null;
  streaming_links: AniListExternalLink[];
  synced_at: string | null;
  notes: string | null;
  watched_at: string | null;
  created_at: string;
  updated_at: string;
}
