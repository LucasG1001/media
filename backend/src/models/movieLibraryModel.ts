import { pool } from "../database/connection.js";
import { createLibraryModel } from "../lib/createLibraryModel.js";
import type {
  MovieLibraryEntry,
  CreateMovieLibraryEntry,
  UpdateMovieLibraryEntry,
  MovieLibraryRow,
  MovieSyncData,
} from "../types/movieLibrary.js";

export const movieLibraryModel = createLibraryModel<MovieLibraryEntry, CreateMovieLibraryEntry, UpdateMovieLibraryEntry>({
  table: "movie_library",
  externalId: { column: "tmdb_id", field: "tmdbId" },
  fields: [
    { column: "title", field: "title" },
    { column: "poster_image", field: "posterImage", default: null },
    { column: "status", field: "status", default: "plan_to_watch" },
    { column: "score", field: "score", default: 0, numeric: true },
    { column: "release_date", field: "releaseDate", default: null },
    { column: "runtime", field: "runtime", default: null },
    { column: "movie_status", field: "movieStatus", default: "RELEASED" },
    { column: "collection_id", field: "collectionId", default: null },
    { column: "is_cover", field: "isCover", default: false, readonly: true },
    { column: "synced_at", field: "syncedAt", default: null, readonly: true },
    { column: "notes", field: "notes", default: null },
  ],
  statusField: "status",
  completion: { column: "watched_at", field: "watchedAt", whenStatus: "watched" },
  lastAccess: { column: "last_access_at", field: "lastAccessAt" },
  collectionColumn: "collection_id",
});

function toEntry(row: MovieLibraryRow): MovieLibraryEntry {
  return {
    id: row.id,
    tmdbId: row.tmdb_id,
    title: row.title,
    posterImage: row.poster_image,
    status: row.status,
    score: parseFloat(row.score),
    releaseDate: row.release_date,
    runtime: row.runtime,
    movieStatus: row.movie_status,
    collectionId: row.collection_id,
    isCover: row.is_cover,
    syncedAt: row.synced_at,
    notes: row.notes,
    watchedAt: row.watched_at,
    lastAccessAt: row.last_access_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// TTL curto para não lançados (a data pode ser adiada) e longo para lançados,
// que só mudam título/capa. `limit` espalha o primeiro backfill entre execuções:
// o TMDB não tem endpoint em lote, é 1 requisição por filme.
export async function findStaleMovies(
  upcomingTtlHours: number,
  releasedTtlHours: number,
  limit: number
): Promise<MovieLibraryEntry[]> {
  const result = await pool.query<MovieLibraryRow>(
    `SELECT * FROM movie_library
     WHERE status != 'dropped'
       AND (
         synced_at IS NULL
         OR (movie_status = 'UPCOMING' AND synced_at < NOW() - ($1 || ' hours')::interval)
         OR (movie_status != 'UPCOMING' AND synced_at < NOW() - ($2 || ' hours')::interval)
       )
     ORDER BY synced_at ASC NULLS FIRST
     LIMIT $3`,
    [upcomingTtlHours, releasedTtlHours, limit]
  );
  return result.rows.map(toEntry);
}

// Título/pôster usam COALESCE(NULLIF(...)): o TMDB em pt-BR às vezes devolve
// poster_path nulo, e um job silencioso não pode trocar uma capa boa por nada.
export async function updateMovieSyncData(tmdbId: number, data: MovieSyncData): Promise<void> {
  await pool.query(
    `UPDATE movie_library
     SET title = COALESCE(NULLIF($2, ''), title),
         poster_image = COALESCE(NULLIF($3, ''), poster_image),
         release_date = COALESCE($4, release_date),
         runtime = COALESCE($5, runtime),
         movie_status = $6,
         synced_at = NOW()
     WHERE tmdb_id = $1`,
    [tmdbId, data.title ?? null, data.posterImage ?? null, data.releaseDate ?? null, data.runtime ?? null, data.movieStatus]
  );
}

export async function bulkUpsertMovies(entries: CreateMovieLibraryEntry[], collectionId: number): Promise<MovieLibraryEntry[]> {
  if (entries.length === 0) return [];

  const values: unknown[] = [];
  const rows: string[] = [];
  let i = 1;

  for (const entry of entries) {
    const statusParam = `$${i + 3}`;
    rows.push(
      `($${i}, $${i + 1}, $${i + 2}, ${statusParam}, $${i + 4}, $${i + 5}, $${i + 6}, $${i + 7}, $${i + 8}, CASE WHEN ${statusParam} = 'watched' THEN NOW() ELSE NULL END, CASE WHEN ${statusParam} = 'watched' THEN NOW() ELSE NULL END)`
    );
    values.push(
      entry.tmdbId,
      entry.title,
      entry.posterImage ?? null,
      entry.status ?? "plan_to_watch",
      entry.score ?? 0,
      entry.releaseDate ?? null,
      entry.runtime ?? null,
      entry.movieStatus ?? "RELEASED",
      collectionId
    );
    i += 9;
  }

  const result = await pool.query<MovieLibraryRow>(
    `INSERT INTO movie_library
       (tmdb_id, title, poster_image, status, score, release_date, runtime, movie_status, collection_id, watched_at, last_access_at)
     VALUES ${rows.join(", ")}
     ON CONFLICT (tmdb_id) DO UPDATE SET
       collection_id = COALESCE(movie_library.collection_id, EXCLUDED.collection_id)
     RETURNING *`,
    values
  );
  return result.rows.map(toEntry);
}
