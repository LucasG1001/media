import { pool } from "../database/connection.js";
import { createLibraryModel } from "../lib/createLibraryModel.js";
import type { LibraryEntry, LibraryRow, CreateLibraryEntry, UpdateLibraryEntry, SyncLibraryData } from "../types/library.js";

export const animeLibraryModel = createLibraryModel<LibraryEntry, CreateLibraryEntry, UpdateLibraryEntry>({
  table: "anime_library",
  externalId: { column: "anilist_id", field: "anilistId" },
  fields: [
    { column: "title", field: "title" },
    { column: "cover_image", field: "coverImage", default: null },
    { column: "status", field: "status", default: "plan_to_watch" },
    { column: "score", field: "score", default: 0, numeric: true },
    { column: "total_episodes", field: "totalEpisodes", default: null },
    { column: "anime_status", field: "animeStatus", default: "FINISHED" },
    { column: "franchise_id", field: "franchiseId", default: null },
    { column: "format", field: "format", default: null },
    { column: "season_year", field: "seasonYear", default: null },
    { column: "next_airing_episode", field: "nextAiringEpisode", default: null },
    { column: "streaming_links", field: "streamingLinks", default: [] },
    { column: "synced_at", field: "syncedAt", default: null },
    { column: "is_cover", field: "isCover", default: false, readonly: true },
    { column: "notes", field: "notes", default: null },
  ],
  statusField: "status",
  completion: { column: "watched_at", field: "watchedAt", whenStatus: "watched" },
  collectionColumn: "franchise_id",
  rewatch: { column: "is_rewatching", field: "isRewatching" },
});

// CRUD padrão vem da factory; funções específicas de anime (JSONB, sync, franquia) ficam abaixo.
export const findAll = animeLibraryModel.findAll;
export const findById = animeLibraryModel.findById;
export const findByAnilistId = animeLibraryModel.findByExternalId;
export const update = animeLibraryModel.update;
export const updateManyStatus = animeLibraryModel.updateManyStatus;
export const remove = animeLibraryModel.remove;
export const removeMany = animeLibraryModel.removeMany;
export const setCover = animeLibraryModel.setCover!;

function toLibraryEntry(row: LibraryRow): LibraryEntry {
  return {
    id: row.id,
    anilistId: row.anilist_id,
    title: row.title,
    coverImage: row.cover_image,
    status: row.status,
    score: parseFloat(row.score),
    totalEpisodes: row.total_episodes,
    animeStatus: row.anime_status,
    franchiseId: row.franchise_id,
    isCover: row.is_cover,
    isRewatching: row.is_rewatching,
    format: row.format,
    seasonYear: row.season_year,
    nextAiringEpisode: row.next_airing_episode,
    streamingLinks: row.streaming_links ?? [],
    syncedAt: row.synced_at,
    notes: row.notes,
    watchedAt: row.watched_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Sem condição por `season_year IS NULL`: a AniList devolve seasonYear nulo
// legitimamente (filmes, OVAs, anime sem data), então essas linhas nunca saíam
// do conjunto stale — eram rebuscadas a cada 30 min para sempre. Linha nunca
// sincronizada já é coberta por `synced_at IS NULL`, que tem saída garantida.
export async function findStale(nonFinishedTtlHours: number, finishedTtlHours: number): Promise<LibraryEntry[]> {
  const result = await pool.query<LibraryRow>(
    `SELECT * FROM anime_library
     WHERE synced_at IS NULL
        OR (anime_status != 'FINISHED' AND synced_at < NOW() - ($1 || ' hours')::interval)
        OR (anime_status = 'FINISHED' AND synced_at < NOW() - ($2 || ' hours')::interval)`,
    [nonFinishedTtlHours, finishedTtlHours]
  );
  return result.rows.map(toLibraryEntry);
}

export async function create(entry: CreateLibraryEntry): Promise<LibraryEntry> {
  const result = await pool.query<LibraryRow>(
    `INSERT INTO anime_library
       (anilist_id, title, cover_image, status, score, total_episodes, anime_status, season_year, next_airing_episode, streaming_links, synced_at, watched_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), CASE WHEN $4 = 'watched' THEN NOW() ELSE NULL END)
     RETURNING *`,
    [
      entry.anilistId,
      entry.title,
      entry.coverImage ?? null,
      entry.status ?? "plan_to_watch",
      entry.score ?? 0,
      entry.totalEpisodes ?? null,
      entry.animeStatus ?? "FINISHED",
      entry.seasonYear ?? null,
      JSON.stringify(entry.nextAiringEpisode ?? null),
      JSON.stringify(entry.streamingLinks ?? []),
    ]
  );
  return toLibraryEntry(result.rows[0]);
}

export async function bulkUpsert(entries: CreateLibraryEntry[], franchiseId: number): Promise<LibraryEntry[]> {
  if (entries.length === 0) return [];

  const values: unknown[] = [];
  const rows: string[] = [];
  let i = 1;

  for (const entry of entries) {
    const statusParam = `$${i + 3}`;
    rows.push(
      `($${i}, $${i + 1}, $${i + 2}, ${statusParam}, $${i + 4}, $${i + 5}, $${i + 6}, $${i + 7}, $${i + 8}, $${i + 9}, $${i + 10}, $${i + 11}, NOW(), CASE WHEN ${statusParam} = 'watched' THEN NOW() ELSE NULL END)`
    );
    values.push(
      entry.anilistId,
      entry.title,
      entry.coverImage ?? null,
      entry.status ?? "plan_to_watch",
      entry.score ?? 0,
      entry.totalEpisodes ?? null,
      entry.animeStatus ?? "FINISHED",
      entry.seasonYear ?? null,
      JSON.stringify(entry.nextAiringEpisode ?? null),
      JSON.stringify(entry.streamingLinks ?? []),
      franchiseId,
      entry.format ?? null
    );
    i += 12;
  }

  const result = await pool.query<LibraryRow>(
    `INSERT INTO anime_library
       (anilist_id, title, cover_image, status, score, total_episodes, anime_status, season_year, next_airing_episode, streaming_links, franchise_id, format, synced_at, watched_at)
     VALUES ${rows.join(", ")}
     ON CONFLICT (anilist_id) DO UPDATE SET
       franchise_id = COALESCE(anime_library.franchise_id, EXCLUDED.franchise_id),
       format = COALESCE(anime_library.format, EXCLUDED.format)
     RETURNING *`,
    values
  );
  return result.rows.map(toLibraryEntry);
}

// Título/capa usam COALESCE(NULLIF(...)): a AniList ocasionalmente devolve o
// campo vazio, e um job silencioso não pode trocar uma capa boa por nada.
export async function updateSyncData(anilistId: number, data: SyncLibraryData): Promise<void> {
  await pool.query(
    `UPDATE anime_library
     SET total_episodes = $2,
         anime_status = $3,
         next_airing_episode = $4,
         streaming_links = $5,
         season_year = $6,
         title = COALESCE(NULLIF($7, ''), title),
         cover_image = COALESCE(NULLIF($8, ''), cover_image),
         format = COALESCE($9, format),
         synced_at = NOW()
     WHERE anilist_id = $1`,
    [
      anilistId,
      data.totalEpisodes,
      data.animeStatus,
      JSON.stringify(data.nextAiringEpisode ?? null),
      JSON.stringify(data.streamingLinks ?? []),
      data.seasonYear ?? null,
      data.title ?? null,
      data.coverImage ?? null,
      data.format ?? null,
    ]
  );
}
