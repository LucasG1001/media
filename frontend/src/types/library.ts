import type { AnimeNextAiringEpisode, AnimeExternalLink } from "./anime";

export type LibraryStatus = "plan_to_watch" | "watched" | "dropped";

export interface LibraryEntry {
  id: string;
  anilistId: number;
  title: string;
  coverImage: string | null;
  status: LibraryStatus;
  score: number;
  totalEpisodes: number | null;
  animeStatus?: string;
  franchiseId: number | null;
  isCover: boolean;
  isRewatching: boolean;
  format?: string | null;
  seasonYear: number | null;
  nextAiringEpisode: AnimeNextAiringEpisode | null;
  streamingLinks: AnimeExternalLink[];
  syncedAt: string | null;
  notes: string | null;
  watchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLibraryEntry {
  anilistId: number;
  title: string;
  coverImage?: string | null;
  status?: LibraryStatus;
  score?: number;
  totalEpisodes?: number | null;
  animeStatus?: string;
  seasonYear?: number | null;
  nextAiringEpisode?: AnimeNextAiringEpisode | null;
  streamingLinks?: AnimeExternalLink[];
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

export const LIBRARY_STATUS_LABELS: Record<LibraryStatus, string> = {
  plan_to_watch: "Planejo Assistir",
  watched: "Assistido",
  dropped: "Abandonado",
};
