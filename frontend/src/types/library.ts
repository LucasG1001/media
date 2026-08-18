import type { AnimeNextAiringEpisode, AnimeExternalLink } from "./anime";

// Episódio já exibido. Distinto do próximo episódio, que é o que ainda vai ao ar.
export interface AnimeAiredEpisode {
  episode: number;
  airingAt: number;
}

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
  format?: string | null;
  seasonYear: number | null;
  nextAiringEpisode: AnimeNextAiringEpisode | null;
  // Data do último episódio exibido (ISO); null = a AniList não sabe. É o
  // "terminou de lançar" do anime.
  endDate: string | null;
  // Último episódio já exibido; só preenchido enquanto o anime está RELEASING.
  lastAiredEpisode: AnimeAiredEpisode | null;
  streamingLinks: AnimeExternalLink[];
  syncedAt: string | null;
  notes: string | null;
  watchedAt: string | null;
  lastAccessAt: string | null;
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
  notes?: string | null;
}

export const LIBRARY_STATUS_LABELS: Record<LibraryStatus, string> = {
  plan_to_watch: "Planejo Assistir",
  watched: "Assistido",
  dropped: "Abandonado",
};
