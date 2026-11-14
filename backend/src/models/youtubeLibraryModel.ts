import { pool } from "../database/connection.js";
import { createLibraryModel } from "../lib/createLibraryModel.js";
import { chunk } from "../lib/chunk.js";
import type {
  YoutubeLibraryEntry,
  YoutubeKind,
  CreateYoutubeLibraryEntry,
  UpdateYoutubeLibraryEntry,
} from "../types/youtubeLibrary.js";

export const youtubeLibraryModel = createLibraryModel<
  YoutubeLibraryEntry,
  CreateYoutubeLibraryEntry,
  UpdateYoutubeLibraryEntry
>({
  table: "youtube_library",
  externalId: { column: "video_id", field: "videoId" },
  fields: [
    { column: "title", field: "title" },
    { column: "channel_id", field: "channelId", default: null },
    { column: "channel_title", field: "channelTitle", default: null },
    { column: "channel_thumbnail", field: "channelThumbnail", default: null },
    { column: "thumbnail", field: "thumbnail", default: null },
    { column: "duration_seconds", field: "durationSeconds", default: 0, numeric: true },
    { column: "view_count", field: "viewCount", default: 0, numeric: true },
    { column: "published_at", field: "publishedAt", default: null },
    { column: "description", field: "description", default: null },
    { column: "kind", field: "kind", default: "video" },
    { column: "status", field: "status", default: "liked" },
    { column: "score", field: "score", default: 0, numeric: true },
    { column: "notes", field: "notes", default: null },
    // Último acesso do YouTube não é dirigido por status (o whenStatus é `liked`,
    // que é o default — qualquer salvar estamparia a data): quem grava é o
    // touchAccess, chamado quando o item começa a tocar. Daí `readonly`.
    { column: "last_access_at", field: "lastAccessAt", default: null, readonly: true },
    { column: "synced_at", field: "syncedAt", default: null, readonly: true },
  ],
  statusField: "status",
  completion: { column: "liked_at", field: "likedAt", whenStatus: "liked" },
});

// Playlist colada entra solta, no tipo da aba em que foi colada. Item que já
// existe fica como está — inclusive o tipo dele.
export async function bulkInsertVideos(
  videos: CreateYoutubeLibraryEntry[],
  kind: YoutubeKind
): Promise<number> {
  if (videos.length === 0) return 0;

  const CHUNK = 300;
  let count = 0;

  for (const slice of chunk(videos, CHUNK)) {
    const values: unknown[] = [];
    const rows: string[] = [];
    let i = 1;

    for (const v of slice) {
      rows.push(
        `($${i}, $${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6}, $${i + 7}, $${i + 8}, $${i + 9}, $${i + 10}, 'liked', 0, NOW())`
      );
      values.push(
        v.videoId,
        v.title,
        v.channelId ?? null,
        v.channelTitle ?? null,
        v.channelThumbnail ?? null,
        v.thumbnail ?? null,
        v.durationSeconds ?? 0,
        v.viewCount ?? 0,
        v.publishedAt ?? null,
        v.description ?? null,
        kind
      );
      i += 11;
    }

    const result = await pool.query(
      `INSERT INTO youtube_library
         (video_id, title, channel_id, channel_title, channel_thumbnail, thumbnail,
          duration_seconds, view_count, published_at, description, kind, status, score, liked_at)
       VALUES ${rows.join(", ")}
       ON CONFLICT (video_id) DO NOTHING`,
      values
    );
    count += result.rowCount ?? 0;
  }

  return count;
}

// Não toca `updated_at`: tocar um item é passivo e não pode reordenar a biblioteca.
export async function touchAccess(id: string): Promise<YoutubeLibraryEntry | null> {
  const result = await pool.query(
    `UPDATE youtube_library SET last_access_at = NOW() WHERE id = $1`,
    [id]
  );
  if ((result.rowCount ?? 0) === 0) return null;
  return youtubeLibraryModel.findById(id);
}

export interface YoutubeSyncData {
  title: string;
  thumbnail: string | null;
  channelTitle: string | null;
  durationSeconds: number;
  viewCount: number;
  description: string | null;
}

export async function findStaleVideoIds(ttlHours: number): Promise<string[]> {
  const result = await pool.query<{ video_id: string }>(
    `SELECT video_id FROM youtube_library
      WHERE status != 'removed'
        AND (synced_at IS NULL OR synced_at < NOW() - ($1 || ' hours')::interval)
      ORDER BY synced_at ASC NULLS FIRST`,
    [ttlHours]
  );
  return result.rows.map((row) => row.video_id);
}

// COALESCE(NULLIF(...)): resposta com campo vazio não pode apagar um valor bom —
// duração e views vêm 0 quando o YouTube omite o bloco (estatística oculta).
// Não toca `updated_at`: refresh de fundo não pode reordenar a biblioteca.
export async function updateVideoSyncData(videoId: string, data: YoutubeSyncData): Promise<void> {
  await pool.query(
    `UPDATE youtube_library
        SET title = COALESCE(NULLIF($2, ''), title),
            thumbnail = COALESCE(NULLIF($3, ''), thumbnail),
            channel_title = COALESCE(NULLIF($4, ''), channel_title),
            duration_seconds = COALESCE(NULLIF($5::int, 0), duration_seconds),
            view_count = COALESCE(NULLIF($6::bigint, 0), view_count),
            description = COALESCE($7, description),
            synced_at = NOW()
      WHERE video_id = $1`,
    [videoId, data.title, data.thumbnail, data.channelTitle, data.durationSeconds, data.viewCount, data.description]
  );
}

// Vídeo que sumiu do YouTube (apagado/privado) não volta na resposta. Sem marcar
// o sync, a linha ficaria stale para sempre e voltaria em todo tick.
export async function markVideosSynced(videoIds: string[]): Promise<void> {
  if (videoIds.length === 0) return;
  await pool.query(`UPDATE youtube_library SET synced_at = NOW() WHERE video_id = ANY($1::text[])`, [videoIds]);
}
