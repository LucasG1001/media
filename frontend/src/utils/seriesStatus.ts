import type { SeriesLibraryEntry, SeriesLibraryStatus } from "../types/seriesLibrary";

// O status que vale é o da temporada; só a série sem season_list (fallback) usa o
// da linha — mesma divisão de buildSeasonGroups.
export function seriesHasStatus(entry: SeriesLibraryEntry, status: SeriesLibraryStatus): boolean {
  const seasons = entry.seasonList ?? [];
  if (seasons.length === 0) return entry.status === status;
  return seasons.some((s) => (entry.seasonStates?.[String(s.number)]?.status ?? "plan_to_watch") === status);
}
