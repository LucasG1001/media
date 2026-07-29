import type { Request, Response } from "express";
import type { PoolClient } from "pg";
import { spawn } from "node:child_process";
import { pool } from "../database/connection.js";
import * as libraryModel from "../models/libraryModel.js";
import { movieLibraryModel } from "../models/movieLibraryModel.js";
import { seriesLibraryModel } from "../models/seriesLibraryModel.js";
import { gameLibraryModel } from "../models/gameLibraryModel.js";
import { bookLibraryModel } from "../models/bookLibraryModel.js";
import { youtubeLibraryModel } from "../models/youtubeLibraryModel.js";
import { notifyError } from "../services/notifyService.js";

interface ColumnSpec {
  column: string;
  get: (entry: Record<string, unknown>) => unknown;
  json?: boolean;
}

interface TableSpec {
  key: string;
  table: string;
  conflict: string;
  columns: ColumnSpec[];
}

const TABLES: TableSpec[] = [
  {
    key: "anime",
    table: "anime_library",
    conflict: "anilist_id",
    columns: [
      { column: "anilist_id", get: (e) => e.anilistId },
      { column: "title", get: (e) => e.title },
      { column: "cover_image", get: (e) => e.coverImage ?? null },
      { column: "status", get: (e) => e.status ?? "plan_to_watch" },
      { column: "score", get: (e) => e.score ?? 0 },
      { column: "total_episodes", get: (e) => e.totalEpisodes ?? null },
      { column: "anime_status", get: (e) => e.animeStatus ?? "FINISHED" },
      { column: "season_year", get: (e) => e.seasonYear ?? null },
      { column: "next_airing_episode", get: (e) => e.nextAiringEpisode ?? null, json: true },
      { column: "streaming_links", get: (e) => e.streamingLinks ?? [], json: true },
      { column: "franchise_id", get: (e) => e.franchiseId ?? null },
      { column: "format", get: (e) => e.format ?? null },
      { column: "watched_at", get: (e) => e.watchedAt ?? null },
      { column: "synced_at", get: (e) => e.syncedAt ?? null },
      { column: "notes", get: (e) => e.notes ?? null },
    ],
  },
  {
    key: "movies",
    table: "movie_library",
    conflict: "tmdb_id",
    columns: [
      { column: "tmdb_id", get: (e) => e.tmdbId },
      { column: "title", get: (e) => e.title },
      { column: "poster_image", get: (e) => e.posterImage ?? null },
      { column: "status", get: (e) => e.status ?? "plan_to_watch" },
      { column: "score", get: (e) => e.score ?? 0 },
      { column: "release_date", get: (e) => e.releaseDate ?? null },
      { column: "runtime", get: (e) => e.runtime ?? null },
      { column: "movie_status", get: (e) => e.movieStatus ?? "RELEASED" },
      { column: "collection_id", get: (e) => e.collectionId ?? null },
      { column: "watched_at", get: (e) => e.watchedAt ?? null },
      { column: "synced_at", get: (e) => e.syncedAt ?? null },
      { column: "notes", get: (e) => e.notes ?? null },
    ],
  },
  {
    key: "series",
    table: "series_library",
    conflict: "tmdb_id",
    columns: [
      { column: "tmdb_id", get: (e) => e.tmdbId },
      { column: "title", get: (e) => e.title },
      { column: "poster_image", get: (e) => e.posterImage ?? null },
      { column: "status", get: (e) => e.status ?? "plan_to_watch" },
      { column: "score", get: (e) => e.score ?? 0 },
      { column: "first_air_date", get: (e) => e.firstAirDate ?? null },
      { column: "seasons", get: (e) => e.seasons ?? null },
      { column: "episodes", get: (e) => e.episodes ?? null },
      { column: "series_status", get: (e) => e.seriesStatus ?? "RELEASED" },
      { column: "air_status", get: (e) => e.airStatus ?? null },
      { column: "next_airing_episode", get: (e) => e.nextAiringEpisode ?? null, json: true },
      { column: "synced_at", get: (e) => e.syncedAt ?? null },
      { column: "watched_at", get: (e) => e.watchedAt ?? null },
      // Estado por temporada (status/nota/reassistindo/anotação) — sem isto o
      // import zera a coleção de temporadas.
      { column: "season_list", get: (e) => e.seasonList ?? null, json: true },
      { column: "season_states", get: (e) => e.seasonStates ?? null, json: true },
      { column: "cover_season", get: (e) => e.coverSeason ?? null },
    ],
  },
  {
    key: "games",
    table: "game_library",
    conflict: "igdb_id",
    columns: [
      { column: "igdb_id", get: (e) => e.igdbId },
      { column: "title", get: (e) => e.title },
      { column: "background_image", get: (e) => e.backgroundImage ?? null },
      { column: "status", get: (e) => e.status ?? "plan_to_play" },
      { column: "score", get: (e) => e.score ?? 0 },
      { column: "released", get: (e) => e.released ?? null },
      { column: "metacritic", get: (e) => e.metacritic ?? null },
      { column: "game_status", get: (e) => e.gameStatus ?? "RELEASED" },
      { column: "collection_id", get: (e) => e.collectionId ?? null },
      { column: "game_modes", get: (e) => e.gameModes ?? null },
      { column: "finished_at", get: (e) => e.finishedAt ?? null },
      { column: "synced_at", get: (e) => e.syncedAt ?? null },
      { column: "notes", get: (e) => e.notes ?? null },
    ],
  },
  {
    key: "books",
    table: "books_library",
    conflict: "google_books_id",
    columns: [
      { column: "google_books_id", get: (e) => e.googleBooksId },
      { column: "title", get: (e) => e.title },
      { column: "cover_image", get: (e) => e.coverImage ?? null },
      { column: "authors", get: (e) => e.authors ?? null },
      { column: "status", get: (e) => e.status ?? "plan_to_read" },
      { column: "score", get: (e) => e.score ?? 0 },
      { column: "published_date", get: (e) => e.publishedDate ?? null },
      { column: "page_count", get: (e) => e.pageCount ?? null },
      { column: "read_at", get: (e) => e.readAt ?? null },
      { column: "notes", get: (e) => e.notes ?? null },
    ],
  },
  {
    key: "youtubeCollections",
    table: "youtube_collection",
    conflict: "id",
    columns: [
      { column: "id", get: (e) => e.id },
      { column: "name", get: (e) => e.name },
    ],
  },
  {
    key: "youtube",
    table: "youtube_library",
    conflict: "video_id",
    columns: [
      { column: "video_id", get: (e) => e.videoId },
      { column: "title", get: (e) => e.title },
      { column: "channel_id", get: (e) => e.channelId ?? null },
      { column: "channel_title", get: (e) => e.channelTitle ?? null },
      { column: "channel_thumbnail", get: (e) => e.channelThumbnail ?? null },
      { column: "thumbnail", get: (e) => e.thumbnail ?? null },
      { column: "duration_seconds", get: (e) => e.durationSeconds ?? null },
      { column: "view_count", get: (e) => e.viewCount ?? null },
      { column: "published_at", get: (e) => e.publishedAt ?? null },
      { column: "description", get: (e) => e.description ?? null },
      { column: "status", get: (e) => e.status ?? "liked" },
      { column: "score", get: (e) => e.score ?? 0 },
      { column: "collection_id", get: (e) => e.collectionId ?? null },
      { column: "is_cover", get: (e) => e.isCover ?? false },
      { column: "is_rewatching", get: (e) => e.isRewatching ?? false },
      { column: "liked_at", get: (e) => e.likedAt ?? null },
      { column: "notes", get: (e) => e.notes ?? null },
      { column: "tag", get: (e) => e.tag ?? null },
    ],
  },
];

export async function exportAll(_req: Request, res: Response): Promise<void> {
  try {
    const [anime, movies, series, games, books, youtube, youtubeCollectionsResult] = await Promise.all([
      libraryModel.findAll(),
      movieLibraryModel.findAll(),
      seriesLibraryModel.findAll(),
      gameLibraryModel.findAll(),
      bookLibraryModel.findAll(),
      youtubeLibraryModel.findAll(),
      pool.query("SELECT id, name FROM youtube_collection ORDER BY id"),
    ]);
    res.json({
      version: 1,
      exportedAt: new Date().toISOString(),
      anime,
      movies,
      series,
      games,
      books,
      youtubeCollections: youtubeCollectionsResult.rows,
      youtube,
    });
  } catch (error) {
    void notifyError("API backup/export", error);
    res.status(500).json({ error: "Erro ao exportar a biblioteca." });
  }
}

export function exportDump(_req: Request, res: Response): void {
  const url = process.env.DATABASE_URL;
  if (!url) {
    res.status(500).json({ error: "Banco de dados não configurado." });
    return;
  }

  const date = new Date().toISOString().slice(0, 10);
  const child = spawn("pg_dump", ["-Fc", "-d", url]);
  let stderr = "";
  let started = false;

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  child.on("error", (error) => {
    void notifyError("API backup/dump spawn", error);
    if (!res.headersSent) res.status(500).json({ error: "Erro ao gerar o dump do banco." });
  });

  child.stdout.once("data", (chunk: Buffer) => {
    started = true;
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="media-tracker-backup-${date}.dump"`);
    res.write(chunk);
    child.stdout.pipe(res);
  });

  child.on("close", (code) => {
    if (code === 0) return;
    void notifyError("API backup/dump", new Error(stderr || `pg_dump encerrou com código ${code}`));
    if (!started && !res.headersSent) res.status(500).json({ error: "Erro ao gerar o dump do banco." });
    else res.end();
  });
}

async function upsertRows(client: PoolClient, spec: TableSpec, rows: Record<string, unknown>[]): Promise<number> {
  const updates = spec.columns
    .filter((c) => c.column !== spec.conflict)
    .map((c) => `${c.column} = EXCLUDED.${c.column}`)
    .concat("updated_at = NOW()")
    .join(", ");
  const cols = spec.columns.map((c) => c.column).join(", ");
  let count = 0;

  for (const row of rows) {
    const values = spec.columns.map((c) => {
      const value = c.get(row);
      return c.json ? JSON.stringify(value ?? null) : value;
    });
    const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
    await client.query(
      `INSERT INTO ${spec.table} (${cols}) VALUES (${placeholders})
       ON CONFLICT (${spec.conflict}) DO UPDATE SET ${updates}`,
      values
    );
    count += 1;
  }

  return count;
}

export async function importAll(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Arquivo de backup inválido." });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const imported: Record<string, number> = {};
    for (const spec of TABLES) {
      const rows = body[spec.key];
      if (!Array.isArray(rows)) continue;
      imported[spec.key] = await upsertRows(client, spec, rows as Record<string, unknown>[]);
    }
    if (Array.isArray(body.youtubeCollections) && body.youtubeCollections.length > 0) {
      await client.query(
        "SELECT setval(pg_get_serial_sequence('youtube_collection', 'id'), (SELECT COALESCE(MAX(id), 1) FROM youtube_collection))"
      );
    }
    await client.query("COMMIT");
    res.json({ imported });
  } catch (error) {
    await client.query("ROLLBACK");
    void notifyError("API backup/import", error);
    res.status(500).json({ error: "Erro ao importar o backup." });
  } finally {
    client.release();
  }
}
