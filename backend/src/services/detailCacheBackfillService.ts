import { chunk } from "../lib/chunk.js";
import { singleFlight } from "../lib/singleFlight.js";
import type { DetailCache } from "../models/detailCacheModel.js";
import {
  animeDetailCache,
  bookDetailCache,
  gameDetailCache,
  movieDetailCache,
  seriesDetailCache,
} from "../models/detailCacheModel.js";
import { fetchAnimeById } from "./anilistService.js";
import { fetchMovieById } from "./tmdbService.js";
import { fetchSeriesById } from "./tmdbSeriesService.js";
import { fetchGameById } from "./igdbService.js";
import { fetchBookById } from "./hardcoverService.js";
import { notifyError } from "./notifyService.js";

interface BackfillTarget {
  name: string;
  cache: DetailCache;
  fetchDetail: (id: number) => Promise<unknown>;
  runLimit: number;
}

const DETAIL_PATH = ["detail"];
const CONCURRENCY = 5;
const RETRY_DAYS = 7;

// A AniList tem teto baixo (~30 req/min na prática) e o limiter dela é global ao
// processo: um lote grande aqui atrasaria a busca do catálogo. Por isso o teto
// menor — é backfill, tem todo o tempo do mundo para drenar.
const ANILIST_RUN_LIMIT = 10;
const RUN_LIMIT = 50;

const TARGETS: BackfillTarget[] = [
  { name: "anime", cache: animeDetailCache, fetchDetail: fetchAnimeById, runLimit: ANILIST_RUN_LIMIT },
  { name: "movie", cache: movieDetailCache, fetchDetail: fetchMovieById, runLimit: RUN_LIMIT },
  { name: "series", cache: seriesDetailCache, fetchDetail: fetchSeriesById, runLimit: RUN_LIMIT },
  { name: "game", cache: gameDetailCache, fetchDetail: fetchGameById, runLimit: RUN_LIMIT },
  { name: "book", cache: bookDetailCache, fetchDetail: fetchBookById, runLimit: RUN_LIMIT },
];

export const backfillDetailCache = singleFlight(doBackfillDetailCache);

async function doBackfillDetailCache(): Promise<void> {
  for (const target of TARGETS) {
    await backfillTarget(target);
  }
}

async function backfillTarget(target: BackfillTarget): Promise<void> {
  const pending = await target.cache.findMissing(target.runLimit, RETRY_DAYS);
  if (pending.length === 0) return;

  for (const batch of chunk(pending, CONCURRENCY)) {
    await Promise.all(
      batch.map(async (externalId) => {
        try {
          const detail = await target.fetchDetail(externalId);
          await target.cache.save(externalId, DETAIL_PATH, detail);
        } catch (error) {
          // Carimba a tentativa para a linha não voltar no próximo tick: sem isso
          // um id morto na API externa seguraria a fila para sempre.
          await target.cache.markFailure(externalId).catch(() => undefined);
          await notifyError(`detailCacheBackfillService.${target.name}`, error, {
            externalId: String(externalId),
          });
        }
      })
    );
  }
}
