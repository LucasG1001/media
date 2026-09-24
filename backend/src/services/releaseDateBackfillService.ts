import { chunk } from "../lib/chunk.js";
import * as libraryModel from "../models/libraryModel.js";
import { findSeriesWithoutLastAired, updateSeriesSyncData } from "../models/seriesLibraryModel.js";
import { fetchAnimesByIds, fetchLastAiredEpisodes } from "./anilistService.js";
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
            genres: anime.genres,
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
            genres: fresh.genres,
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

// Último episódio exibido do anime em exibição. Em regime quem mantém isso é o
// refresh horário; aqui é só para a coluna não nascer vazia (a linha só entra no
// refresh depois de ficar stale, e até lá o carrossel de episódios fica sem
// anime nenhum). Uma requisição por lote de 25.
async function backfillAnimeLastAired(): Promise<number> {
  const ids = await libraryModel.findReleasingWithoutLastAired();
  if (ids.length === 0) return 0;

  try {
    const latest = await fetchLastAiredEpisodes(ids);
    for (const [anilistId, aired] of latest) {
      await libraryModel.setLastAiredEpisode(anilistId, aired);
    }
    return latest.size;
  } catch (error) {
    await notifyError("releaseDateBackfillService.animeLastAired", error, { total: String(ids.length) });
    return 0;
  }
}

export async function backfillReleaseDates(): Promise<{ anime: number; animeLastAired: number; series: number }> {
  return {
    anime: await backfillAnimeEndDate(),
    animeLastAired: await backfillAnimeLastAired(),
    series: await backfillSeriesLastAired(),
  };
}
