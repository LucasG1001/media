import { describe, it, expect } from "vitest";
import { seriesHasStatus } from "./seriesStatus";
import type { SeriesLibraryEntry, SeriesSeasonMeta } from "../types/seriesLibrary";

function season(number: number): SeriesSeasonMeta {
  return { number, name: null, poster: null, episodeCount: null, airDate: null };
}

function series(over: Partial<SeriesLibraryEntry> = {}): SeriesLibraryEntry {
  return {
    id: "uuid-1",
    tmdbId: 1,
    title: "Serie",
    posterImage: null,
    status: "plan_to_watch",
    score: 0,
    firstAirDate: null,
    seasons: 2,
    episodes: 20,
    seriesStatus: "RELEASED",
    airStatus: "Ended",
    nextAiringEpisode: null,
    lastAiredEpisode: null,
    syncedAt: null,
    seasonList: null,
    seasonStates: null,
    coverSeason: null,
    watchedAt: null,
    lastAccessAt: null,
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

describe("seriesHasStatus", () => {
  it("usa o status das temporadas quando ha season_list", () => {
    const entry = series({
      status: "watched",
      seasonList: [season(1), season(2)],
      seasonStates: { "1": { status: "watched", score: 8 }, "2": { status: "rewatching", score: 0 } },
    });
    expect(seriesHasStatus(entry, "rewatching")).toBe(true);
  });

  it("ignora o status da linha quando ha temporadas", () => {
    const entry = series({ status: "rewatching", seasonList: [season(1)], seasonStates: null });
    expect(seriesHasStatus(entry, "rewatching")).toBe(false);
    expect(seriesHasStatus(entry, "plan_to_watch")).toBe(true);
  });

  it("cai no status da linha sem season_list", () => {
    expect(seriesHasStatus(series({ status: "rewatching" }), "rewatching")).toBe(true);
  });
});
