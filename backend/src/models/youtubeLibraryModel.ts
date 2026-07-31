import { pool } from "../database/connection.js";
import { createLibraryModel } from "../lib/createLibraryModel.js";
import { chunk } from "../lib/chunk.js";
import type {
  YoutubeLibraryEntry,
  YoutubeCollection,
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
    { column: "collection_id", field: "collectionId", default: null },
    { column: "is_cover", field: "isCover", default: false, readonly: true },
    // Último acesso do YouTube não é dirigido por status (o whenStatus é `liked`,
    // que é o default — qualquer salvar estamparia a data): quem grava é o
    // touchAccess, chamado ao abrir o drawer do vídeo. Daí `readonly`.
    { column: "last_access_at", field: "lastAccessAt", default: null, readonly: true },
    // `text[]` vai como array JS direto (igual game_modes), sem JSON.stringify.
    { column: "tags", field: "tags", default: [] },
  ],
  statusField: "status",
  completion: { column: "liked_at", field: "likedAt", whenStatus: "liked" },
  collectionColumn: "collection_id",
});

// Playlist importada vira uma coleção com o nome dela.
export async function bulkUpsertVideos(
  videos: CreateYoutubeLibraryEntry[],
  collectionId: number
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
        collectionId
      );
      i += 11;
    }

    // Vídeo que já existe só entra na coleção nova se ainda não tiver uma:
    // reimportar não rouba vídeo de outra coleção.
    const result = await pool.query(
      `INSERT INTO youtube_library
         (video_id, title, channel_id, channel_title, channel_thumbnail, thumbnail,
          duration_seconds, view_count, published_at, description, status, score, collection_id, liked_at)
       VALUES ${rows.join(", ")}
       ON CONFLICT (video_id) DO UPDATE SET
         collection_id = COALESCE(youtube_library.collection_id, EXCLUDED.collection_id),
         updated_at = NOW()`,
      values
    );
    count += result.rowCount ?? 0;
  }

  return count;
}

// Abrir o drawer do vídeo é o que conta como acesso no YouTube (não o status, nem
// um botão de "assisti de novo" como nas outras mídias). Não toca `updated_at`:
// abrir um vídeo é passivo e não pode reordenar a biblioteca.
export async function touchAccess(id: string): Promise<YoutubeLibraryEntry | null> {
  const result = await pool.query(
    `UPDATE youtube_library SET last_access_at = NOW() WHERE id = $1`,
    [id]
  );
  if ((result.rowCount ?? 0) === 0) return null;
  return youtubeLibraryModel.findById(id);
}

// `collection_id IS NOT NULL` firma a regra no banco: tag só existe dentro de
// coleção. O resto do WHERE evita tag duplicada no array.
export async function addTagMany(ids: string[], tag: string): Promise<number> {
  if (ids.length === 0) return 0;
  const result = await pool.query(
    `UPDATE youtube_library
        SET tags = array_append(tags, $2), updated_at = NOW()
      WHERE id = ANY($1::uuid[])
        AND collection_id IS NOT NULL
        AND NOT (tags @> ARRAY[$2]::text[])`,
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

export async function createCollection(name: string): Promise<YoutubeCollection> {
  const result = await pool.query<YoutubeCollection>(
    `INSERT INTO youtube_collection (name) VALUES ($1) RETURNING id, name`,
    [name]
  );
  return result.rows[0];
}

export async function renameCollection(id: number, name: string): Promise<YoutubeCollection | null> {
  const result = await pool.query<YoutubeCollection>(
    `UPDATE youtube_collection SET name = $2, updated_at = NOW() WHERE id = $1 RETURNING id, name`,
    [id, name]
  );
  return result.rows[0] ?? null;
}

// Trocar de coleção zera as tags: o vocabulário é da coleção de origem e não
// significa nada na de destino. Entrar pela primeira vez cai no mesmo ramo.
export async function assignCollection(ids: string[], collectionId: number): Promise<number> {
  if (ids.length === 0) return 0;
  const result = await pool.query(
    `UPDATE youtube_library
        SET collection_id = $2,
            tags = CASE WHEN collection_id IS DISTINCT FROM $2 THEN '{}'::text[] ELSE tags END,
            updated_at = NOW()
      WHERE id = ANY($1::uuid[])`,
    [ids, collectionId]
  );
  return result.rowCount ?? 0;
}

export async function removeFromCollection(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const result = await pool.query(
    `UPDATE youtube_library
        SET collection_id = NULL, is_cover = FALSE, tags = '{}', updated_at = NOW()
      WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  return result.rowCount ?? 0;
}

export async function listCollections(): Promise<YoutubeCollection[]> {
  const result = await pool.query<YoutubeCollection>(
    `SELECT c.id, c.name
       FROM youtube_collection c
       JOIN youtube_library l ON l.collection_id = c.id
      GROUP BY c.id, c.name
      ORDER BY c.name ASC`
  );
  return result.rows;
}

export async function pruneEmptyCollections(): Promise<void> {
  await pool.query(
    `DELETE FROM youtube_collection c
      WHERE NOT EXISTS (SELECT 1 FROM youtube_library l WHERE l.collection_id = c.id)`
  );
}
