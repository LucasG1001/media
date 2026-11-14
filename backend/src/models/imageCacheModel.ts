import { pool } from "../database/connection.js";

export interface ImageCacheEntry {
  urlHash: string;
  url: string;
  contentType: string | null;
  bytes: number | null;
}

export interface ImageCacheStats {
  total: number;
  failed: number;
  bytes: number;
}

export async function findImageCache(urlHash: string): Promise<ImageCacheEntry | null> {
  const result = await pool.query(
    `SELECT url_hash, url, content_type, bytes FROM image_cache WHERE url_hash = $1`,
    [urlHash]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    urlHash: String(row.url_hash),
    url: String(row.url),
    contentType: row.content_type === null ? null : String(row.content_type),
    bytes: row.bytes === null ? null : Number(row.bytes),
  };
}

export async function saveImageCache(
  urlHash: string,
  url: string,
  contentType: string,
  bytes: number
): Promise<void> {
  await pool.query(
    `INSERT INTO image_cache (url_hash, url, content_type, bytes, fetched_at, last_hit_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (url_hash) DO UPDATE
        SET url = EXCLUDED.url,
            content_type = EXCLUDED.content_type,
            bytes = EXCLUDED.bytes,
            fetched_at = NOW(),
            last_hit_at = NOW()`,
    [urlHash, url, contentType, bytes]
  );
}

// content_type NULL marca tentativa que falhou. fetched_at serve de relógio do
// backoff: sem ele uma capa que saiu do ar seria rebaixada a cada varredura.
export async function markImageFailure(urlHash: string, url: string): Promise<void> {
  await pool.query(
    `INSERT INTO image_cache (url_hash, url, content_type, bytes, fetched_at)
     VALUES ($1, $2, NULL, NULL, NOW())
     ON CONFLICT (url_hash) DO UPDATE
        SET content_type = NULL,
            bytes = NULL,
            fetched_at = NOW()`,
    [urlHash, url]
  );
}

export async function touchImageHit(urlHash: string): Promise<void> {
  await pool.query(`UPDATE image_cache SET last_hit_at = NOW() WHERE url_hash = $1`, [urlHash]);
}

export async function findRecentFailures(withinHours: number): Promise<Set<string>> {
  const result = await pool.query(
    `SELECT url_hash FROM image_cache
      WHERE content_type IS NULL
        AND fetched_at > NOW() - ($1 || ' hours')::interval`,
    [String(withinHours)]
  );
  return new Set(result.rows.map((row) => String(row.url_hash)));
}

export async function findStaleImageCache(unusedDays: number): Promise<ImageCacheEntry[]> {
  const result = await pool.query(
    `SELECT url_hash, url, content_type, bytes FROM image_cache
      WHERE last_hit_at IS NULL OR last_hit_at < NOW() - ($1 || ' days')::interval`,
    [String(unusedDays)]
  );
  return result.rows.map((row) => ({
    urlHash: String(row.url_hash),
    url: String(row.url),
    contentType: row.content_type === null ? null : String(row.content_type),
    bytes: row.bytes === null ? null : Number(row.bytes),
  }));
}

export async function deleteImageCache(urlHashes: string[]): Promise<void> {
  if (urlHashes.length === 0) return;
  await pool.query(`DELETE FROM image_cache WHERE url_hash = ANY($1::text[])`, [urlHashes]);
}

export async function getImageCacheStats(): Promise<ImageCacheStats> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE content_type IS NULL)::int AS failed,
            COALESCE(SUM(bytes), 0)::bigint AS bytes
       FROM image_cache`
  );
  const row = result.rows[0];
  return { total: Number(row.total), failed: Number(row.failed), bytes: Number(row.bytes) };
}

// Todas as imagens que a biblioteca referencia hoje. Os pôsteres de temporada
// vivem dentro do JSONB season_list, por isso o jsonb_array_elements.
export async function findReferencedImageUrls(): Promise<string[]> {
  const result = await pool.query(
    `SELECT DISTINCT url FROM (
       SELECT cover_image      AS url FROM anime_library
       UNION ALL SELECT poster_image      FROM movie_library
       UNION ALL SELECT poster_image      FROM series_library
       UNION ALL SELECT season->>'poster'
                   FROM series_library,
                        jsonb_array_elements(COALESCE(season_list, '[]'::jsonb)) AS season
       UNION ALL SELECT background_image  FROM game_library
       UNION ALL SELECT cover_image       FROM books_library
       UNION ALL SELECT thumbnail         FROM youtube_library
       UNION ALL SELECT channel_thumbnail FROM youtube_library
     ) refs
     WHERE url IS NOT NULL AND url <> ''`
  );
  return result.rows.map((row) => String(row.url));
}
