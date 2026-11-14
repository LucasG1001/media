export type YoutubeLibraryStatus = "liked" | "removed";

// Música e vídeo são a mesma mídia; `kind` é a aba em que o item aparece.
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
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateYoutubeLibraryEntry {
  videoId: string;
  title: string;
  channelTitle?: string | null;
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
  kind?: YoutubeKind;
  status?: YoutubeLibraryStatus;
  score?: number;
  notes?: string | null;
}

export const YOUTUBE_LIBRARY_STATUS_LABELS: Record<YoutubeLibraryStatus, string> = {
  liked: "Gostei",
  removed: "Removido",
};

// Músicas primeiro: é a ordem das abas.
export const YOUTUBE_KIND_LABELS: Record<YoutubeKind, string> = {
  music: "Músicas",
  video: "Vídeos",
};

export function otherKind(kind: YoutubeKind): YoutubeKind {
  return kind === "music" ? "video" : "music";
}
