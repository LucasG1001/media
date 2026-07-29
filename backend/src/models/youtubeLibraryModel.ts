import { pool } from "../database/connection.js";
import { createLibraryModel } from "../lib/createLibraryModel.js";
import { chunk } from "../lib/chunk.js";
import type {
  YoutubeLibraryEntry,
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
    { column: "status", field: "status", default: "liked" },
    { column: "score", field: "score", default: 0, numeric: true },
    { column: "notes", field: "notes", default: null },
    // `text[]` vai como array JS direto (igual game_modes), sem JSON.stringify.
    { column: "tags", field: "tags", default: [] },
  ],
  statusField: "status",
  completion: { column: "liked_at", field: "likedAt", whenStatus: "liked" },
  rewatch: { column: "is_rewatching", field: "isRewatching" },
});

// Playlist importada entra com o nome dela como primeira tag dos vídeos.
export async function bulkUpsertVideos(
  videos: CreateYoutubeLibraryEntry[],
  tag: string
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
        `($${i}, $${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6}, $${i + 7}, $${i + 8}, $${i + 9}, 'liked', 0, $${i + 10}, NOW())`
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
        [tag]
      );
      i += 11;
    }

    // Vídeo que já existe só ganha a tag da playlist se ainda não tiver nenhuma:
    // reimportar não atropela o que foi ajustado à mão.
    const result = await pool.query(
      `INSERT INTO youtube_library
         (video_id, title, channel_id, channel_title, channel_thumbnail, thumbnail,
          duration_seconds, view_count, published_at, description, status, score, tags, liked_at)
       VALUES ${rows.join(", ")}
       ON CONFLICT (video_id) DO UPDATE SET
         tags = CASE
           WHEN cardinality(youtube_library.tags) = 0 THEN EXCLUDED.tags
           ELSE youtube_library.tags
         END,
         updated_at = NOW()`,
      values
    );
    count += result.rowCount ?? 0;
  }

  return count;
}

// O WHERE é o que evita tag duplicada no array.
export async function addTagMany(ids: string[], tag: string): Promise<number> {
  if (ids.length === 0) return 0;
  const result = await pool.query(
    `UPDATE youtube_library
        SET tags = array_append(tags, $2), updated_at = NOW()
      WHERE id = ANY($1::uuid[]) AND NOT (tags @> ARRAY[$2]::text[])`,
    [ids, tag]
  );
  return result.rowCount ?? 0;
}

export async function removeTagMany(ids: string[], tag: string): Promise<number> {
  if (ids.length === 0) return 0;
  const result = await pool.query(
    `UPDATE youtube_library
        SET tags = array_remove(tags, $2), updated_at = NOW()
      WHERE id = ANY($1::uuid[]) AND tags @> ARRAY[$2]::text[]`,
    [ids, tag]
  );
  return result.rowCount ?? 0;
}
