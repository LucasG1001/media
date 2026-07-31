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
  // N tags por vídeo; `[]` = sem tag. Só existem dentro de coleção: vídeo avulso
  // tem sempre `[]`, e sair da coleção zera.
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
  // `null` = vídeo avulso, que não tem tag (nem a linha de chips).
  collectionId: number | null;
  tags: string[];
}

export const YOUTUBE_LIBRARY_STATUS_LABELS: Record<YoutubeLibraryStatus, string> = {
  liked: "Gostei",
  removed: "Removido",
};
