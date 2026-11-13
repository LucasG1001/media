import { describe, it, expect, vi, beforeEach } from "vitest";
import { AxiosError } from "axios";
import type { AxiosResponse } from "axios";
import type { SeriesLibraryEntry } from "../types/seriesLibrary.js";

vi.mock("../models/seriesLibraryModel.js", () => ({
  findStaleSeries: vi.fn(),
  updateSeriesSyncData: vi.fn().mockResolvedValue(undefined),
  findDueSeriesEpisodes: vi.fn(),
  markSeriesEpisodeNotified: vi.fn(),
}));
vi.mock("./tmdbSeriesService.js", () => ({ fetchSeriesSyncData: vi.fn() }));
vi.mock("./tmdbMissingService.js", () => ({ resolveMissingSeries: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./notifyService.js", () => ({
  notifyError: vi.fn().mockResolvedValue(undefined),
  notifySeriesNewEpisode: vi.fn(),
  notifySeriesFinished: vi.fn(),
}));

const { refreshStaleSeries } = await import("./seriesLibrarySyncService.js");
const { findStaleSeries, updateSeriesSyncData } = await import("../models/seriesLibraryModel.js");
const { fetchSeriesSyncData } = await import("./tmdbSeriesService.js");
const { resolveMissingSeries } = await import("./tmdbMissingService.js");
const { notifyError } = await import("./notifyService.js");

function httpError(status: number): AxiosError {
  return new AxiosError(`Request failed with status code ${status}`, "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data: {},
  } as AxiosResponse);
}

const entry = {
  id: "1",
  tmdbId: 800,
  title: "Ruptura",
  syncedAt: null,
  nextAiringEpisode: null,
  imdbId: "tt11280740",
  tmdbMissingAt: null,
} as SeriesLibraryEntry;

const fresh = {
  title: "Ruptura",
  posterImage: null,
  firstAirDate: "2022-02-17",
  seasons: 2,
  episodes: 19,
  seriesStatus: "RELEASED",
  airStatus: "Returning Series",
  nextAiringEpisode: null,
  lastAiredEpisode: null,
  seasonList: [],
  genres: ["Drama"],
  imdbId: "tt11280740",
};

describe("refreshStaleSeries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hands a 404 to the missing-item resolver instead of reporting an error", async () => {
    vi.mocked(findStaleSeries).mockResolvedValue([entry]);
    vi.mocked(fetchSeriesSyncData).mockRejectedValue(httpError(404));

    await refreshStaleSeries();

    expect(resolveMissingSeries).toHaveBeenCalledWith(entry);
    expect(notifyError).not.toHaveBeenCalled();
    expect(updateSeriesSyncData).not.toHaveBeenCalled();
  });

  it("still reports any other failure", async () => {
    vi.mocked(findStaleSeries).mockResolvedValue([entry]);
    vi.mocked(fetchSeriesSyncData).mockRejectedValue(httpError(503));

    await refreshStaleSeries();

    expect(resolveMissingSeries).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledTimes(1);
  });

  it("stores the IMDb id that anchors a future id change", async () => {
    vi.mocked(findStaleSeries).mockResolvedValue([entry]);
    vi.mocked(fetchSeriesSyncData).mockResolvedValue(fresh);

    await refreshStaleSeries();

    expect(updateSeriesSyncData).toHaveBeenCalledWith(800, expect.objectContaining({ imdbId: "tt11280740" }));
  });
});
