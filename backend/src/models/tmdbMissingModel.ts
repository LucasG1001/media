import { pool } from "../database/connection.js";

export interface TmdbMissingStore {
  markMissing(tmdbId: number): Promise<void>;
  repoint(oldTmdbId: number, newTmdbId: number): Promise<boolean>;
}

// O nome da tabela nunca vem de request — só das chamadas abaixo.
export function createTmdbMissingStore(table: string): TmdbMissingStore {
  return {
    // Bumpa synced_at para a linha sair da fila do refresh até o próximo TTL.
    async markMissing(tmdbId) {
      await pool.query(
        `UPDATE ${table}
            SET synced_at = NOW(),
                tmdb_missing_at = COALESCE(tmdb_missing_at, NOW())
          WHERE tmdb_id = $1`,
        [tmdbId]
      );
    },

    // Troca só o id externo: status, nota, anotação e coleção ficam como estão.
    // synced_at e detail_cache voltam a NULL para os jobs rebuscarem pelo id novo.
    // Devolve false quando o id novo já é outra linha da biblioteca.
    async repoint(oldTmdbId, newTmdbId) {
      const result = await pool.query(
        `UPDATE ${table}
            SET tmdb_id = $2,
                synced_at = NULL,
                tmdb_missing_at = NULL,
                detail_cache = NULL,
                detail_cached_at = NULL
          WHERE tmdb_id = $1
            AND NOT EXISTS (SELECT 1 FROM ${table} WHERE tmdb_id = $2)`,
        [oldTmdbId, newTmdbId]
      );
      return (result.rowCount ?? 0) > 0;
    },
  };
}

export const movieMissingStore = createTmdbMissingStore("movie_library");
export const seriesMissingStore = createTmdbMissingStore("series_library");
