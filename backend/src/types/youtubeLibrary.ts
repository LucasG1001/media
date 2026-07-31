export type YoutubeLibraryStatus = "liked" | "removed";

export interface YoutubeCollection {
  id: number;
  name: string;
}

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
  status: YoutubeLibraryStatus;
  score: number;
  likedAt: string | null;
  lastAccessAt: string | null;
  notes: string | null;
  collectionId: number | null;
  isCover: boolean;
  // N tags por vídeo; `[]` = sem tag. Só faz sentido dentro de coleção.
  tags: string[];
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
  status?: YoutubeLibraryStatus;
  score?: number;
  tags?: string[];
}

export interface UpdateYoutubeLibraryEntry {
  title?: string;
  channelTitle?: string | null;
  thumbnail?: string | null;
  durationSeconds?: number | null;
  viewCount?: number | null;
  publishedAt?: string | null;
  description?: string | null;
  status?: YoutubeLibraryStatus;
  score?: number;
  notes?: string | null;
  tags?: string[];
}
