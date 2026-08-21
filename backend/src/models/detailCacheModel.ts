import { pool } from "../database/connection.js";

export interface DetailCache {
  save(externalId: number, path: string[], detail: unknown): Promise<void>;
  markFailure(externalId: number): Promise<void>;
  find(externalId: number, path: string[]): Promise<unknown | null>;
  findMissing(limit: number, retryDays: number): Promise<number[]>;
}

// O nome da tabela e da coluna nunca vêm de request — só das chamadas abaixo.
export function createDetailCache(table: string, idColumn: string): DetailCache {
  return {
    async save(externalId, path, detail) {
      await pool.query(
        `UPDATE ${table}
            SET detail_cache = jsonb_set(COALESCE(detail_cache, '{}'::jsonb), $2::text[], $3::jsonb, true),
                detail_cached_at = NOW()
          WHERE ${idColumn} = $1`,
        [externalId, path, JSON.stringify(detail)]
      );
    },

    async markFailure(externalId) {
      await pool.query(
        `UPDATE ${table}
            SET detail_cache = COALESCE(detail_cache, '{}'::jsonb),
                detail_cached_at = NOW()
          WHERE ${idColumn} = $1`,
        [externalId]
      );
    },

    async find(externalId, path) {
      const result = await pool.query(
        `SELECT detail_cache #> $2::text[] AS value FROM ${table} WHERE ${idColumn} = $1`,
        [externalId, path]
      );
      return result.rows[0]?.value ?? null;
    },

    // Nunca cacheado primeiro; '{}' é tentativa que falhou e volta só depois do
    // retryDays — sem essa janela uma indisponibilidade da API deixaria a
    // biblioteca inteira marcada como falha para sempre.
    async findMissing(limit, retryDays) {
      const result = await pool.query(
        `SELECT ${idColumn} AS external_id FROM ${table}
          WHERE detail_cache IS NULL
             OR (detail_cache = '{}'::jsonb AND detail_cached_at < NOW() - ($1 || ' days')::interval)
          ORDER BY detail_cached_at ASC NULLS FIRST
          LIMIT $2`,
        [String(retryDays), limit]
      );
      return result.rows.map((row) => Number(row.external_id));
    },
  };
}

export const animeDetailCache = createDetailCache("anime_library", "anilist_id");
export const movieDetailCache = createDetailCache("movie_library", "tmdb_id");
export const seriesDetailCache = createDetailCache("series_library", "tmdb_id");
export const gameDetailCache = createDetailCache("game_library", "igdb_id");
export const bookDetailCache = createDetailCache("books_library", "hardcover_id");
