export type MusicLibraryStatus = "liked" | "removed";

export interface MusicLibraryEntry {
  id: string;
  videoId: string;
  title: string;
  channelId: string | null;
  channelTitle: string | null;
  channelThumbnail: string | null;
  thumbnail: string | null;
  durationSeconds: number | null;
  viewCount: number | null;
  publishedAt: string | null;
  description: string | null;
  status: MusicLibraryStatus;
  score: number;
  likedAt: string | null;
  lastAccessAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMusicLibraryEntry {
  videoId: string;
  title: string;
  channelTitle?: string | null;
  thumbnail?: string | null;
  durationSeconds?: number | null;
  viewCount?: number | null;
  publishedAt?: string | null;
  description?: string | null;
  status?: MusicLibraryStatus;
  score?: number;
}

export interface UpdateMusicLibraryEntry {
  title?: string;
  status?: MusicLibraryStatus;
  score?: number;
  notes?: string | null;
}

export const MUSIC_LIBRARY_STATUS_LABELS: Record<MusicLibraryStatus, string> = {
  liked: "Gostei",
  removed: "Removido",
};
