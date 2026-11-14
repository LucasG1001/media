import { cachedRequest, httpRequest } from "../lib/httpClient.js";
import { chunk } from "../lib/chunk.js";

const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/videos";
const YOUTUBE_CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels";
const YOUTUBE_PLAYLISTS_URL = "https://www.googleapis.com/youtube/v3/playlists";
const YOUTUBE_PLAYLIST_ITEMS_URL = "https://www.googleapis.com/youtube/v3/playlistItems";
const CACHE_TTL_MS = 60 * 60 * 1000;

export type YoutubeServiceErrorCode = "missing_key" | "invalid_url" | "not_found";

export class YoutubeServiceError extends Error {
  code: YoutubeServiceErrorCode;
  constructor(code: YoutubeServiceErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "YoutubeServiceError";
  }
}

export interface YoutubeVideoData {
  videoId: string;
  title: string;
  channelId: string | null;
  channelTitle: string | null;
  channelThumbnail: string | null;
  thumbnail: string | null;
  durationSeconds: number;
  viewCount: number;
  publishedAt: string | null;
  description: string | null;
}

interface YoutubeApiThumbnail {
  url: string;
}

interface YoutubeApiItem {
  id: string;
  snippet?: {
    title?: string;
    channelId?: string;
    channelTitle?: string;
    description?: string;
    publishedAt?: string;
    thumbnails?: Record<string, YoutubeApiThumbnail | undefined>;
  };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string };
}

interface YoutubeApiResponse {
  items?: YoutubeApiItem[];
}

interface YoutubePlaylistResponse {
  items?: { snippet?: { title?: string } }[];
}

interface YoutubePlaylistItemsResponse {
  nextPageToken?: string;
  items?: { contentDetails?: { videoId?: string } }[];
}

interface YoutubeChannelsResponse {
  items?: { id: string; snippet?: { thumbnails?: Record<string, YoutubeApiThumbnail | undefined> } }[];
}

export interface YoutubePlaylistData {
  title: string;
  videos: YoutubeVideoData[];
}

const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function extractVideoId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (ID_PATTERN.test(value)) return value;

  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/live\/([A-Za-z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function extractPlaylistId(input: string): string | null {
  const match = input.trim().match(/[?&]list=([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

export function parseIso8601Duration(iso: string | undefined): number {
  if (!iso) return 0;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function pickThumbnail(thumbnails: Record<string, YoutubeApiThumbnail | undefined> | undefined): string | null {
  if (!thumbnails) return null;
  const preferred = ["maxres", "standard", "high", "medium", "default"];
  for (const key of preferred) {
    const thumb = thumbnails[key];
    if (thumb?.url) return thumb.url;
  }
  return null;
}

function mapVideoItem(item: YoutubeApiItem): YoutubeVideoData {
  return {
    videoId: item.id,
    title: item.snippet?.title ?? "Vídeo sem título",
    channelId: item.snippet?.channelId ?? null,
    channelTitle: item.snippet?.channelTitle ?? null,
    channelThumbnail: null,
    thumbnail: pickThumbnail(item.snippet?.thumbnails),
    durationSeconds: parseIso8601Duration(item.contentDetails?.duration),
    viewCount: item.statistics?.viewCount ? Number(item.statistics.viewCount) : 0,
    publishedAt: item.snippet?.publishedAt ?? null,
    description: item.snippet?.description ?? null,
  };
}

async function fetchChannelThumbnail(channelId: string, key: string): Promise<string | null> {
  try {
    const data = await cachedRequest<YoutubeApiResponse>(
      { url: YOUTUBE_CHANNELS_URL, method: "get", params: { id: channelId, part: "snippet", key } },
      CACHE_TTL_MS
    );
    return pickThumbnail(data.items?.[0]?.snippet?.thumbnails);
  } catch {
    return null;
  }
}

export async function fetchVideo(videoId: string): Promise<YoutubeVideoData> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new YoutubeServiceError("missing_key", "YOUTUBE_API_KEY não configurada.");
  }

  const data = await cachedRequest<YoutubeApiResponse>(
    {
      url: YOUTUBE_API_URL,
      method: "get",
      params: { id: videoId, part: "snippet,contentDetails,statistics", key },
    },
    CACHE_TTL_MS
  );

  const item = data.items?.[0];
  if (!item) {
    throw new YoutubeServiceError("not_found", "Vídeo não encontrado no YouTube.");
  }

  const video = mapVideoItem(item);
  video.channelThumbnail = video.channelId ? await fetchChannelThumbnail(video.channelId, key) : null;
  return video;
}

export const YOUTUBE_VIDEOS_BATCH_SIZE = 50;

// Para o refresh de fundo: um lote de até 50 ids numa requisição só, **sem
// cache** (o conjunto de ids é determinístico — com cache o tick seguinte só
// bumparia `synced_at`) e sem avatar de canal, que custaria outra chamada.
// Vídeo apagado ou privado simplesmente não volta no mapa.
export async function fetchVideosByIds(videoIds: string[]): Promise<Map<string, YoutubeVideoData>> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new YoutubeServiceError("missing_key", "YOUTUBE_API_KEY não configurada.");
  }
  const map = new Map<string, YoutubeVideoData>();
  if (videoIds.length === 0) return map;

  const data = await httpRequest<YoutubeApiResponse>({
    url: YOUTUBE_API_URL,
    method: "get",
    params: { id: videoIds.join(","), part: "snippet,contentDetails,statistics", key },
  });
  for (const item of data.items ?? []) map.set(item.id, mapVideoItem(item));
  return map;
}

async function fetchChannelThumbnails(channelIds: string[], key: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const batch of chunk(channelIds, 50)) {
    try {
      const data = await cachedRequest<YoutubeChannelsResponse>(
        { url: YOUTUBE_CHANNELS_URL, method: "get", params: { id: batch.join(","), part: "snippet", key } },
        CACHE_TTL_MS
      );
      for (const ch of data.items ?? []) {
        const thumb = pickThumbnail(ch.snippet?.thumbnails);
        if (thumb) map.set(ch.id, thumb);
      }
    } catch {
      /* avatares são opcionais */
    }
  }
  return map;
}

export async function fetchPlaylist(playlistId: string): Promise<YoutubePlaylistData> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new YoutubeServiceError("missing_key", "YOUTUBE_API_KEY não configurada.");
  }

  const meta = await cachedRequest<YoutubePlaylistResponse>(
    { url: YOUTUBE_PLAYLISTS_URL, method: "get", params: { id: playlistId, part: "snippet", key } },
    CACHE_TTL_MS
  );
  const title = meta.items?.[0]?.snippet?.title;
  if (!title) {
    throw new YoutubeServiceError("not_found", "Playlist não encontrada no YouTube.");
  }

  const videoIds: string[] = [];
  let pageToken: string | undefined;
  do {
    const page: YoutubePlaylistItemsResponse = await httpRequestPage(playlistId, key, pageToken);
    for (const item of page.items ?? []) {
      const id = item.contentDetails?.videoId;
      if (id) videoIds.push(id);
    }
    pageToken = page.nextPageToken;
  } while (pageToken);

  const videos: YoutubeVideoData[] = [];
  for (const batch of chunk(videoIds, 50)) {
    const data = await cachedRequest<YoutubeApiResponse>(
      {
        url: YOUTUBE_API_URL,
        method: "get",
        params: { id: batch.join(","), part: "snippet,contentDetails,statistics", key },
      },
      CACHE_TTL_MS
    );
    for (const item of data.items ?? []) videos.push(mapVideoItem(item));
  }

  const uniqueChannels = [...new Set(videos.map((v) => v.channelId).filter((id): id is string => !!id))];
  const avatars = await fetchChannelThumbnails(uniqueChannels, key);
  for (const video of videos) {
    if (video.channelId) video.channelThumbnail = avatars.get(video.channelId) ?? null;
  }

  return { title, videos };
}

function httpRequestPage(
  playlistId: string,
  key: string,
  pageToken: string | undefined
): Promise<YoutubePlaylistItemsResponse> {
  return cachedRequest<YoutubePlaylistItemsResponse>(
    {
      url: YOUTUBE_PLAYLIST_ITEMS_URL,
      method: "get",
      params: { playlistId, part: "contentDetails", maxResults: 50, pageToken, key },
    },
    CACHE_TTL_MS
  );
}
