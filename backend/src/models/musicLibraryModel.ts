import { pool } from "../database/connection.js";
import { createLibraryModel } from "../lib/createLibraryModel.js";
import { chunk } from "../lib/chunk.js";
import type {
  MusicLibraryEntry,
  CreateMusicLibraryEntry,
  UpdateMusicLibraryEntry,
} from "../types/musicLibrary.js";

export const musicLibraryModel = createLibraryModel<
  MusicLibraryEntry,
  CreateMusicLibraryEntry,
  UpdateMusicLibraryEntry
>({
  table: "music_library",
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
    // Mesmo motivo do YouTube: o acesso é abrir a música (touchAccess), não o status.
    { column: "last_access_at", field: "lastAccessAt", default: null, readonly: true },
  ],
  statusField: "status",
  completion: { column: "liked_at", field: "likedAt", whenStatus: "liked" },
});

// Playlist colada em Música entra solta. Faixa que já existe fica como está.
export async function bulkInsertTracks(tracks: CreateMusicLibraryEntry[]): Promise<number> {
  if (tracks.length === 0) return 0;

  const CHUNK = 300;
  let count = 0;

  for (const slice of chunk(tracks, CHUNK)) {
    const values: unknown[] = [];
    const rows: string[] = [];
    let i = 1;

    for (const t of slice) {
      rows.push(
        `($${i}, $${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6}, $${i + 7}, $${i + 8}, $${i + 9}, 'liked', 0, NOW())`
      );
      values.push(
        t.videoId,
        t.title,
        t.channelId ?? null,
        t.channelTitle ?? null,
        t.channelThumbnail ?? null,
        t.thumbnail ?? null,
        t.durationSeconds ?? 0,
        t.viewCount ?? 0,
        t.publishedAt ?? null,
        t.description ?? null
      );
      i += 10;
    }

    const result = await pool.query(
      `INSERT INTO music_library
         (video_id, title, channel_id, channel_title, channel_thumbnail, thumbnail,
          duration_seconds, view_count, published_at, description, status, score, liked_at)
       VALUES ${rows.join(", ")}
       ON CONFLICT (video_id) DO NOTHING`,
      values
    );
    count += result.rowCount ?? 0;
  }

  return count;
}

// Não toca `updated_at`: abrir é passivo e não pode reordenar a biblioteca.
export async function touchAccess(id: string): Promise<MusicLibraryEntry | null> {
  const result = await pool.query(
    `UPDATE music_library SET last_access_at = NOW() WHERE id = $1`,
    [id]
  );
  if ((result.rowCount ?? 0) === 0) return null;
  return musicLibraryModel.findById(id);
}

// Leva o vídeo do YouTube para Música: copia o que é do vídeo e do usuário (nota,
// anotação, status, datas) e apaga a linha de origem. Coleção, capa e tags ficam
// para trás — não existem em Música. Se a música já existe do outro lado, o
// vídeo só sai do YouTube (a linha de Música não é sobrescrita).
export async function moveFromYoutube(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO music_library
         (video_id, title, channel_id, channel_title, channel_thumbnail, thumbnail,
          duration_seconds, view_count, published_at, description, status, score,
          notes, liked_at, last_access_at)
       SELECT video_id, title, channel_id, channel_title, channel_thumbnail, thumbnail,
              duration_seconds, view_count, published_at, description, status, score,
              notes, liked_at, last_access_at
         FROM youtube_library
        WHERE id = ANY($1::uuid[])
       ON CONFLICT (video_id) DO NOTHING`,
      [ids]
    );
    const removed = await client.query(
      `DELETE FROM youtube_library WHERE id = ANY($1::uuid[])`,
      [ids]
    );
    await client.query("COMMIT");
    return removed.rowCount ?? 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
