import { pool } from "../database/connection.js";
import { notifyMovieReleased, notifyGameReleased, notifyBookReleased, notifyError } from "./notifyService.js";

const RECENT_WINDOW_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dateOnlyToMs(date: string | null): number | null {
  if (!date) return null;
  let ms = new Date(`${date}T00:00:00`).getTime();
  if (Number.isNaN(ms)) ms = new Date(date).getTime();
  return Number.isNaN(ms) ? null : ms;
}

interface ReleaseRow {
  id: string;
  tmdb_id?: number;
  igdb_id?: number;
  hardcover_id?: number;
  title: string;
  image: string | null;
  released: string | null;
}

async function processTable(
  table: "movie_library" | "game_library" | "books_library",
  idColumn: "tmdb_id" | "igdb_id" | "hardcover_id",
  imageColumn: "poster_image" | "background_image" | "cover_image",
  dateColumn: "release_date" | "released" | "published_date",
  notify: (row: ReleaseRow) => Promise<void>
): Promise<void> {
  const { rows } = await pool.query<ReleaseRow>(
    `SELECT id, ${idColumn} AS ${idColumn}, title, ${imageColumn} AS image, ${dateColumn} AS released
       FROM ${table}
      WHERE release_notified_at IS NULL AND status != 'dropped'`
  );

  const endOfToday = startOfToday() + DAY_MS - 1;
  const windowStart = startOfToday() - RECENT_WINDOW_DAYS * DAY_MS;

  for (const row of rows) {
    const when = dateOnlyToMs(row.released);
    // Sem data ou ainda no futuro: deixa para reavaliar nos próximos dias.
    if (when == null || when > endOfToday) continue;
    // Só notifica lançamentos recentes; backlog antigo é marcado em silêncio.
    if (when >= windowStart) await notify(row);
    await pool.query(`UPDATE ${table} SET release_notified_at = NOW() WHERE id = $1`, [row.id]);
  }
}

let inFlight: Promise<void> | null = null;

export function notifyDueReleases(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = doNotify().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doNotify(): Promise<void> {
  try {
    await processTable("movie_library", "tmdb_id", "poster_image", "release_date", (row) =>
      notifyMovieReleased({ tmdbId: row.tmdb_id as number, title: row.title, posterImage: row.image })
    );
  } catch (error) {
    await notifyError("releaseNotifyService.movies", error);
  }
  try {
    await processTable("game_library", "igdb_id", "background_image", "released", (row) =>
      notifyGameReleased({ title: row.title, backgroundImage: row.image })
    );
  } catch (error) {
    await notifyError("releaseNotifyService.games", error);
  }
  try {
    await processTable("books_library", "hardcover_id", "cover_image", "published_date", (row) =>
      notifyBookReleased({ title: row.title, coverImage: row.image })
    );
  } catch (error) {
    await notifyError("releaseNotifyService.books", error);
  }
}
