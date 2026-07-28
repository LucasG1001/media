import { useCallback } from "react";
import { useLibraryStore } from "../context/libraryStore";
import * as seriesLibraryService from "../services/seriesLibraryService";
import type {
  SeriesLibraryEntry,
  CreateSeriesLibraryEntry,
  UpdateSeriesLibraryEntry,
  SeriesLibraryStatus,
} from "../types/seriesLibrary";

export function useSeriesLibrary() {
  const store = useLibraryStore<SeriesLibraryEntry, CreateSeriesLibraryEntry, UpdateSeriesLibraryEntry>(
    "series",
    seriesLibraryService,
    (entry) => entry.tmdbId
  );

  // Estado por temporada (status/nota/reassistindo): patch otimista de
  // seasonStates + score (média das notas > 0; mantém a atual se nenhuma tem nota).
  const { mutate, entries } = store;
  const saveSeason = useCallback(
    (
      id: string,
      seasonNumber: number,
      data: { status: SeriesLibraryStatus; score: number; isRewatching: boolean }
    ): Promise<SeriesLibraryEntry | null> => {
      const entry = entries.find((e) => e.id === id);
      if (!entry) return Promise.resolve(null);
      const states = { ...(entry.seasonStates ?? {}) };
      states[String(seasonNumber)] = data;
      const values = Object.values(states).map((s) => s.score).filter((v) => v > 0);
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      const optimistic: Partial<SeriesLibraryEntry> = {
        seasonStates: states,
        score: avg > 0 ? avg : entry.score,
      };
      return mutate(id, optimistic, () => seriesLibraryService.saveSeason(id, seasonNumber, data));
    },
    [mutate, entries]
  );

  const setCoverSeason = useCallback(
    (id: string, seasonNumber: number): Promise<SeriesLibraryEntry | null> =>
      mutate(id, { coverSeason: seasonNumber }, () => seriesLibraryService.setCoverSeason(id, seasonNumber)),
    [mutate]
  );

  return { ...store, findByTmdbId: store.findByExternalId, saveSeason, setCoverSeason };
}
