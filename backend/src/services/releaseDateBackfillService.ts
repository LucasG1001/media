import { chunk } from "../lib/chunk.js";
import * as libraryModel from "../models/libraryModel.js";
import { findSeriesWithoutLastAired, updateSeriesSyncData } from "../models/seriesLibraryModel.js";
import { fetchAnimesByIds } from "./anilistService.js";
import { fetchSeriesSyncData } from "./tmdbSeriesService.js";
import { notifyError } from "./notifyService.js";

// Preenche as datas que dizem "terminou de lançar" nas linhas antigas: end_date
// (anime) e last_aired_episode (séries). Sem isso as colunas só se preencheriam
// conforme o TTL do refresh (7 dias para o que já terminou) e o carrossel de
// lançamentos nasceria pela metade. Roda uma vez no boot.
//
// Ambos reaproveitam o update de sync completo, então a linha volta com todos
// os campos frescos, não só a data nova.

// Mesmo tamanho do lote interno do fetchAnimesByIds: 1 consulta por iteração.
const ANILIST_BATCH_SIZE = 50;
// Igual ao refresh de séries: o TMDB é 1 requisição por série e o conjunto todo
// de uma vez tomaria 429.
const TMDB_CONCURRENCY = 10;

async function backfillAnimeEndDate(): Promise<number> {
  const ids = await libraryModel.findAnilistIdsWithoutEndDate();
  if (ids.length === 0) return 0;

  let updated = 0;
  for (const batch of chunk(ids, ANILIST_BATCH_SIZE)) {
    try {
      const animes = await fetchAnimesByIds(batch);
      await Promise.all(
        animes.map((anime) =>
          libraryModel.updateSyncData(anime.id, {
            title: anime.title,
            coverImage: anime.coverImage,
            format: anime.format,
            totalEpisodes: anime.episodes,
            animeStatus: anime.status,
            seasonYear: anime.seasonYear,
            nextAiringEpisode: anime.nextAiringEpisode,
            endDate: anime.endDate,
            streamingLinks: anime.streamingLinks,
          })
        )
      );
      updated += animes.length;
    } catch (error) {
      await notifyError("releaseDateBackfillService.anime", error, { batchSize: String(batch.length) });
    }
  }
  return updated;
}

async function backfillSeriesLastAired(): Promise<number> {
  const series = await findSeriesWithoutLastAired();
  if (series.length === 0) return 0;

  let updated = 0;
  for (const batch of chunk(series, TMDB_CONCURRENCY)) {
    await Promise.all(
      batch.map(async (entry) => {
        try {
          const fresh = await fetchSeriesSyncData(entry.tmdbId);
          await updateSeriesSyncData(entry.tmdbId, {
            title: fresh.title,
            posterImage: fresh.posterImage,
            firstAirDate: fresh.firstAirDate,
            seasons: fresh.seasons,
            episodes: fresh.episodes,
            seriesStatus: fresh.seriesStatus,
            airStatus: fresh.airStatus,
            nextAiringEpisode: fresh.nextAiringEpisode,
            lastAiredEpisode: fresh.lastAiredEpisode,
            seasonList: fresh.seasonList,
          });
          updated += 1;
        } catch (error) {
          await notifyError("releaseDateBackfillService.series", error, { tmdbId: String(entry.tmdbId) });
        }
      })
    );
  }
  return updated;
}

export async function backfillReleaseDates(): Promise<{ anime: number; series: number }> {
  return {
    anime: await backfillAnimeEndDate(),
    series: await backfillSeriesLastAired(),
  };
}
