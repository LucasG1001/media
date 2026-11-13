import { describe, it, expect } from "vitest";
import {
  ANIME_TIER,
  SERIES_TIER,
  bandOf,
  bandRangeLabel,
  buildTierTiles,
  countUnrated,
  groupTierRows,
  releaseYearOf,
  tierYears,
} from "./tierList";
import { buildFranchiseGroups } from "./franchiseGroups";
import { buildSeasonGroups } from "./seasonGroups";
import type { LibraryEntry } from "../types/library";
import type { SeriesLibraryEntry } from "../types/seriesLibrary";

let seq = 0;

function anime(over: Partial<LibraryEntry> = {}): LibraryEntry {
  seq += 1;
  return {
    id: `uuid-${seq}`,
    anilistId: seq,
    title: `Anime ${seq}`,
    coverImage: `cover-${seq}.jpg`,
    status: "watched",
    score: 0,
    totalEpisodes: 12,
    animeStatus: "FINISHED",
    franchiseId: null,
    isCover: false,
    seasonYear: null,
    nextAiringEpisode: null,
    endDate: null,
    lastAiredEpisode: null,
    streamingLinks: [],
    syncedAt: null,
    notes: null,
    watchedAt: null,
    lastAccessAt: null,
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

function series(over: Partial<SeriesLibraryEntry> = {}): SeriesLibraryEntry {
  seq += 1;
  return {
    id: `uuid-${seq}`,
    tmdbId: seq,
    title: `Série ${seq}`,
    posterImage: `poster-${seq}.jpg`,
    status: "plan_to_watch",
    score: 0,
    firstAirDate: null,
    seasons: null,
    episodes: null,
    seriesStatus: "RELEASED",
    airStatus: null,
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

function tilesOf(entries: LibraryEntry[]) {
  return buildTierTiles("anime", buildFranchiseGroups(entries), ANIME_TIER);
}

describe("bandOf", () => {
  it("maps the score ranges to the five bands", () => {
    expect(bandOf(10)).toBe("top");
    expect(bandOf(9)).toBe("top");
    expect(bandOf(8.5)).toBe("good");
    expect(bandOf(7)).toBe("good");
    expect(bandOf(6.5)).toBe("mid");
    expect(bandOf(5)).toBe("mid");
    expect(bandOf(4.5)).toBe("low");
    expect(bandOf(3)).toBe("low");
    expect(bandOf(2.5)).toBe("bottom");
    expect(bandOf(0.5)).toBe("bottom");
  });

  it("uses the score as displayed, so 8.97 (shown as 9.0) is top", () => {
    expect(bandOf(8.97)).toBe("top");
    expect(bandOf(8.94)).toBe("good");
  });
});

describe("bandRangeLabel", () => {
  it("describes each band", () => {
    expect(bandRangeLabel("top")).toBe("Nota 9 a 10");
    expect(bandRangeLabel("good")).toBe("Nota 7 até abaixo de 9");
    expect(bandRangeLabel("bottom")).toBe("Nota 0,5 até abaixo de 3");
  });
});

describe("buildTierTiles", () => {
  it("places a collection by the average of its members, not by each member", () => {
    const tiles = tilesOf([
      anime({ franchiseId: 1, score: 10, isCover: true, title: "Capa" }),
      anime({ franchiseId: 1, score: 6 }),
    ]);

    expect(tiles).toHaveLength(1);
    expect(tiles[0].score).toBe(8);
    expect(tiles[0].row).toBe("good");
    expect(tiles[0].title).toBe("Capa");
    expect(tiles[0].count).toBe(2);
  });

  it("ignores unrated members in the average, like the library does", () => {
    const tiles = tilesOf([
      anime({ franchiseId: 1, score: 9 }),
      anime({ franchiseId: 1, score: 0, status: "plan_to_watch" }),
    ]);

    expect(tiles[0].score).toBe(9);
    expect(tiles[0].row).toBe("top");
  });

  it("sends a completed collection without any score to the unrated tray", () => {
    const tiles = tilesOf([anime({ score: 0, status: "watched" })]);
    expect(tiles[0].row).toBe("unrated");
  });

  it("counts rewatching as completed", () => {
    const tiles = tilesOf([anime({ score: 7, status: "rewatching" })]);
    expect(tiles[0].row).toBe("good");
  });

  it("leaves out collections that are only planned", () => {
    expect(tilesOf([anime({ status: "plan_to_watch", score: 8 })])).toHaveLength(0);
  });

  it("puts in dropped only the collection with no completed member", () => {
    const tiles = tilesOf([
      anime({ franchiseId: 1, status: "dropped", score: 2 }),
      anime({ franchiseId: 2, status: "dropped", score: 4 }),
      anime({ franchiseId: 2, status: "watched", score: 8 }),
    ]);

    const byKey = new Map(tiles.map((t) => [t.key, t]));
    expect(byKey.get("franchise-1")?.row).toBe("dropped");
    expect(byKey.get("franchise-2")?.row).toBe("mid");
  });

  it("marks each completed member with its release and completion years", () => {
    const tiles = tilesOf([
      anime({ franchiseId: 1, score: 9, seasonYear: 2019, watchedAt: "2025-03-10T12:00:00.000Z" }),
      anime({ franchiseId: 1, score: 9, seasonYear: 2026, watchedAt: "2026-07-01T12:00:00.000Z" }),
      anime({ franchiseId: 1, score: 9, seasonYear: null, watchedAt: null }),
    ]);

    expect(tiles[0].marks).toEqual(
      expect.arrayContaining([
        { released: 2019, completed: 2025 },
        { released: 2026, completed: 2026 },
        { released: null, completed: null },
      ])
    );
    expect(tiles[0].marks).toHaveLength(3);
  });

  it("does not mark members that are planned or dropped when something was completed", () => {
    const tiles = tilesOf([
      anime({ franchiseId: 1, score: 9, seasonYear: 2020, watchedAt: "2025-03-10T12:00:00.000Z" }),
      anime({ franchiseId: 1, status: "dropped", seasonYear: 2023 }),
      anime({ franchiseId: 1, status: "plan_to_watch", seasonYear: 2026 }),
    ]);

    expect(tiles[0].marks).toEqual([{ released: 2020, completed: 2025 }]);
  });

  it("marks a dropped collection by the release year of what was dropped", () => {
    const tiles = tilesOf([
      anime({ franchiseId: 1, status: "dropped", seasonYear: 2026, watchedAt: "2026-02-01T12:00:00.000Z" }),
      anime({ franchiseId: 1, status: "plan_to_watch", seasonYear: 2027 }),
    ]);

    expect(tiles[0].row).toBe("dropped");
    expect(tiles[0].marks).toEqual([{ released: 2026, completed: null }]);
  });

  it("falls back to the end date when the anime has no season year", () => {
    const tiles = tilesOf([anime({ score: 8, seasonYear: null, endDate: "2021-12-24" })]);
    expect(tiles[0].marks[0].released).toBe(2021);
  });

  it("treats a series as the collection of its seasons", () => {
    const entry = series({
      title: "Série X",
      seasonList: [
        { number: 1, name: null, poster: "s1.jpg", episodeCount: 10, airDate: "2020-01-01" },
        { number: 2, name: null, poster: "s2.jpg", episodeCount: 10, airDate: "2021-01-01" },
      ],
      seasonStates: {
        "1": { status: "watched", score: 9, lastAccessAt: "2025-05-05T12:00:00.000Z" },
        "2": { status: "watched", score: 6, lastAccessAt: "2026-05-05T12:00:00.000Z" },
      },
      coverSeason: 2,
    });

    const tiles = buildTierTiles("series", buildSeasonGroups([entry]).groups, SERIES_TIER);

    expect(tiles).toHaveLength(1);
    expect(tiles[0].title).toBe("Série X");
    expect(tiles[0].cover).toBe("s2.jpg");
    expect(tiles[0].externalId).toBe(entry.tmdbId);
    expect(tiles[0].score).toBe(7.5);
    expect(tiles[0].row).toBe("good");
    expect(tiles[0].marks).toEqual(
      expect.arrayContaining([
        { released: 2020, completed: 2025 },
        { released: 2021, completed: 2026 },
      ])
    );
  });
});

describe("releaseYearOf", () => {
  it("reads the year from the text, so January 1st does not slip to the previous year", () => {
    expect(releaseYearOf("2020-01-01")).toBe(2020);
    expect(releaseYearOf("1999-12-31")).toBe(1999);
    expect(releaseYearOf("2015")).toBe(2015);
  });

  it("returns null when there is no usable date", () => {
    expect(releaseYearOf(null)).toBeNull();
    expect(releaseYearOf("")).toBeNull();
    expect(releaseYearOf("sem data")).toBeNull();
  });
});

describe("groupTierRows", () => {
  it("orders each row by score, highest first, then by title", () => {
    const tiles = tilesOf([
      anime({ score: 9, title: "Zeta" }),
      anime({ score: 10, title: "Dez" }),
      anime({ score: 9, title: "Alfa" }),
      anime({ score: 9.5, title: "Meio" }),
    ]);

    const rows = groupTierRows(tiles);
    expect(rows.top.map((t) => t.title)).toEqual(["Dez", "Meio", "Alfa", "Zeta"]);
  });

  it("shows the same collection, in the same band, in every year it was watched", () => {
    const tiles = tilesOf([
      anime({ franchiseId: 1, score: 10, watchedAt: "2025-03-10T12:00:00.000Z" }),
      anime({ franchiseId: 1, score: 8, watchedAt: "2026-03-10T12:00:00.000Z" }),
    ]);

    expect(groupTierRows(tiles, { released: null, completed: 2025 }).top).toHaveLength(1);
    expect(groupTierRows(tiles, { released: null, completed: 2026 }).top).toHaveLength(1);
    expect(groupTierRows(tiles, { released: null, completed: 2024 }).top).toHaveLength(0);
  });

  it("hides dropped and undated collections when a completion year is selected", () => {
    const tiles = tilesOf([
      anime({ status: "dropped" }),
      anime({ score: 8, watchedAt: null }),
      anime({ score: 0, watchedAt: "2026-01-10T12:00:00.000Z" }),
    ]);

    const all = groupTierRows(tiles);
    expect(all.dropped).toHaveLength(1);
    expect(all.good).toHaveLength(1);
    expect(all.unrated).toHaveLength(1);

    const filtered = groupTierRows(tiles, { released: null, completed: 2026 });
    expect(filtered.dropped).toHaveLength(0);
    expect(filtered.good).toHaveLength(0);
    expect(filtered.unrated).toHaveLength(1);
  });

  it("filters by release year and keeps the band of the whole collection", () => {
    const tiles = tilesOf([
      anime({ franchiseId: 1, score: 10, seasonYear: 2019 }),
      anime({ franchiseId: 1, score: 2, seasonYear: 2026 }),
      anime({ score: 8, seasonYear: 2026 }),
      anime({ score: 8, seasonYear: 2018 }),
    ]);

    const rows = groupTierRows(tiles, { released: 2026, completed: null });
    expect(rows.mid.map((t) => t.key)).toEqual(["franchise-1"]);
    expect(rows.good).toHaveLength(1);
    expect(rows.bottom).toHaveLength(0);
  });

  it("shows dropped collections under the release year filter", () => {
    const tiles = tilesOf([
      anime({ status: "dropped", seasonYear: 2026 }),
      anime({ status: "dropped", seasonYear: 2020 }),
    ]);

    expect(groupTierRows(tiles, { released: 2026, completed: null }).dropped).toHaveLength(1);
    expect(groupTierRows(tiles, { released: 2026, completed: 2026 }).dropped).toHaveLength(0);
  });

  it("requires both years to match on the same member", () => {
    const tiles = tilesOf([
      anime({ franchiseId: 1, score: 8, seasonYear: 2020, watchedAt: "2026-03-10T12:00:00.000Z" }),
      anime({ franchiseId: 1, score: 8, seasonYear: 2026, watchedAt: "2027-03-10T12:00:00.000Z" }),
    ]);

    expect(groupTierRows(tiles, { released: 2026, completed: 2026 }).good).toHaveLength(0);
    expect(groupTierRows(tiles, { released: 2020, completed: 2026 }).good).toHaveLength(1);
    expect(groupTierRows(tiles, { released: 2026, completed: 2027 }).good).toHaveLength(1);
  });
});

describe("tierYears / countUnrated", () => {
  it("lists the years of each kind, most recent first", () => {
    const tiles = tilesOf([
      anime({ score: 8, seasonYear: 2010, watchedAt: "2024-06-10T12:00:00.000Z" }),
      anime({ score: 8, seasonYear: 2022, watchedAt: "2026-06-10T12:00:00.000Z" }),
      anime({ score: 8, seasonYear: 2010, watchedAt: "2024-08-10T12:00:00.000Z" }),
      anime({ status: "dropped", seasonYear: 2025 }),
    ]);

    expect(tierYears(tiles, "completed")).toEqual([2026, 2024]);
    expect(tierYears(tiles, "released")).toEqual([2025, 2022, 2010]);
  });

  it("counts what is still missing a score", () => {
    const tiles = tilesOf([anime({ score: 0 }), anime({ score: 0 }), anime({ score: 5 }), anime({ status: "dropped" })]);
    expect(countUnrated(tiles)).toBe(2);
  });
});
