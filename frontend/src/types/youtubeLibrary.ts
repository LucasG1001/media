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
  notes: string | null;
  // N tags por vídeo; `[]` = sem tag.
  tags: string[];
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
  status?: YoutubeLibraryStatus;
  score?: number;
}

export interface UpdateYoutubeLibraryEntry {
  title?: string;
  status?: YoutubeLibraryStatus;
  score?: number;
  isRewatching?: boolean;
  notes?: string | null;
  tags?: string[];
}

export interface YoutubeCard {
  id: string;
  title: string;
  thumbnail: string | null;
  channelTitle: string | null;
  channelThumbnail: string | null;
  durationSeconds: number | null;
  viewCount: number | null;
  // O `id` do card é o videoId; as tags são escritas pelo id da entry (UUID).
  entryId: string;
  tags: string[];
}

export const YOUTUBE_LIBRARY_STATUS_LABELS: Record<YoutubeLibraryStatus, string> = {
  liked: "Gostei",
  removed: "Removido",
};

// Filtros de tag: cada bucket pega a faixa seguinte do ranking de popularidade.
// `top` é o corte acumulado; `null` = o restante das tags.
export interface TagBucket {
  label: string;
  top: number | null;
}

export const TAG_BUCKETS_KEY = "youtube-tag-buckets";

export const DEFAULT_TAG_BUCKETS: TagBucket[] = [
  { label: "TOP 5", top: 5 },
  { label: "TOP 10", top: 10 },
  { label: "TOP 20", top: 20 },
  { label: "RESTANTE", top: null },
];
