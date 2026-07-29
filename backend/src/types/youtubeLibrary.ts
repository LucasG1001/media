export type YoutubeLibraryStatus = "liked" | "removed";

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
  isRewatching: boolean;
  collectionId: number | null;
  isCover: boolean;
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
  status?: YoutubeLibraryStatus;
  score?: number;
  isRewatching?: boolean;
  notes?: string | null;
}

export interface YoutubeCollection {
  id: number;
  name: string;
}
