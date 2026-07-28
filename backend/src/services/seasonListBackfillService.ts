import { fetchSeriesById } from "./tmdbSeriesService.js";
import { findSeriesWithoutSeasonList, setSeasonList } from "../models/seriesLibraryModel.js";
import { notifyError } from "./notifyService.js";

// Preenche season_list das séries já salvas que ainda não foram processadas
// (coluna NULL). Uma chamada de detalhe por série; sequencial para não estourar
// a API do TMDB. Idempotente: linhas já com valor não voltam.
export async function backfillSeriesSeasons(): Promise<number> {
  const series = await findSeriesWithoutSeasonList();
  if (series.length === 0) return 0;

  let updated = 0;
  for (const entry of series) {
    try {
      const detail = await fetchSeriesById(entry.tmdbId);
      await setSeasonList(entry.id, detail.seasonList);
      updated += 1;
    } catch (error) {
      await notifyError("seasonListBackfillService.backfillSeriesSeasons", error, {
        tmdbId: String(entry.tmdbId),
      });
    }
  }
  return updated;
}
