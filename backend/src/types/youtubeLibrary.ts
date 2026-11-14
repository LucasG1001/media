export type YoutubeLibraryStatus = "liked" | "removed";

// Música e vídeo vivem na mesma tabela; `kind` é o que decide a aba em que o
// item aparece.
export type YoutubeKind = "music" | "video";

export interface YoutubeLibraryEntry {
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
  kind: YoutubeKind;
  status: YoutubeLibraryStatus;
  score: number;
  likedAt: string | null;
  lastAccessAt: string | null;
  syncedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateYoutubeLibraryEntry {
  videoId: string;
  title: string;
  channelId?: string | null;
  channelTitle?: string | null;
  channelThumbnail?: string | null;
  thumbnail?: string | null;
  durationSeconds?: number | null;
  viewCount?: number | null;
  publishedAt?: string | null;
  description?: string | null;
  kind?: YoutubeKind;
  status?: YoutubeLibraryStatus;
  score?: number;
}

export interface UpdateYoutubeLibraryEntry {
  title?: string;
  channelTitle?: string | null;
  thumbnail?: string | null;
  durationSeconds?: number | null;
  viewCount?: number | null;
  publishedAt?: string | null;
  description?: string | null;
  kind?: YoutubeKind;
  status?: YoutubeLibraryStatus;
  score?: number;
  notes?: string | null;
}
