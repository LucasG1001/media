import type { SeriesCard } from "../types/series";
import type { SeriesLibraryEntry } from "../types/seriesLibrary";

export function seriesLibraryEntryToCard(entry: SeriesLibraryEntry): SeriesCard {
  return {
    id: entry.tmdbId,
    title: entry.title,
    posterImage: entry.posterImage ?? "",
    backdropImage: null,
    firstAirDate: entry.firstAirDate,
    voteAverage: null,
    overview: null,
    seriesStatus: entry.seriesStatus || "RELEASED",
  };
}
