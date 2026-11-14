import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../models/youtubeLibraryModel.js", () => ({
  findStaleVideoIds: vi.fn(),
  updateVideoSyncData: vi.fn().mockResolvedValue(undefined),
  markVideosSynced: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./youtubeService.js", () => ({
  fetchVideosByIds: vi.fn(),
  YOUTUBE_VIDEOS_BATCH_SIZE: 50,
}));
vi.mock("./notifyService.js", () => ({ notifyError: vi.fn().mockResolvedValue(undefined) }));

const { refreshStaleYoutube } = await import("./youtubeLibrarySyncService.js");
const { findStaleVideoIds, updateVideoSyncData, markVideosSynced } = await import(
  "../models/youtubeLibraryModel.js"
);
const { fetchVideosByIds } = await import("./youtubeService.js");
const { notifyError } = await import("./notifyService.js");

function video(videoId: string, viewCount = 100) {
  return {
    videoId,
    title: `Título ${videoId}`,
    channelId: "ch",
    channelTitle: "Canal",
    channelThumbnail: null,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hq.jpg`,
    durationSeconds: 200,
    viewCount,
    publishedAt: "2020-01-01T00:00:00Z",
    description: "desc",
  };
}

function ids(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `v${i}`);
}

describe("refreshStaleYoutube", () => {
  const originalKey = process.env.YOUTUBE_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.YOUTUBE_API_KEY = "key";
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.YOUTUBE_API_KEY;
    else process.env.YOUTUBE_API_KEY = originalKey;
  });

  it("does nothing without an API key", async () => {
    delete process.env.YOUTUBE_API_KEY;
    await refreshStaleYoutube();
    expect(findStaleVideoIds).not.toHaveBeenCalled();
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("does not call YouTube when nothing is stale", async () => {
    vi.mocked(findStaleVideoIds).mockResolvedValue([]);
    await refreshStaleYoutube();
    expect(fetchVideosByIds).not.toHaveBeenCalled();
  });

  it("writes the refreshed fields of each returned video", async () => {
    vi.mocked(findStaleVideoIds).mockResolvedValue(["a"]);
    vi.mocked(fetchVideosByIds).mockResolvedValue(new Map([["a", video("a", 999)]]));

    await refreshStaleYoutube();

    expect(updateVideoSyncData).toHaveBeenCalledWith("a", {
      title: "Título a",
      thumbnail: "https://i.ytimg.com/vi/a/hq.jpg",
      channelTitle: "Canal",
      durationSeconds: 200,
      viewCount: 999,
      description: "desc",
    });
    expect(markVideosSynced).toHaveBeenCalledWith([]);
  });

  // Vídeo apagado ou privado não volta na resposta: sem marcar o sync a linha
  // ficaria stale para sempre.
  it("marks videos missing from the response as synced without touching their data", async () => {
    vi.mocked(findStaleVideoIds).mockResolvedValue(["a", "gone"]);
    vi.mocked(fetchVideosByIds).mockResolvedValue(new Map([["a", video("a")]]));

    await refreshStaleYoutube();

    expect(updateVideoSyncData).toHaveBeenCalledTimes(1);
    expect(markVideosSynced).toHaveBeenCalledWith(["gone"]);
  });

  it("asks YouTube in batches of 50", async () => {
    vi.mocked(findStaleVideoIds).mockResolvedValue(ids(120));
    vi.mocked(fetchVideosByIds).mockResolvedValue(new Map());

    await refreshStaleYoutube();

    expect(vi.mocked(fetchVideosByIds).mock.calls.map(([batch]) => batch.length)).toEqual([50, 50, 20]);
  });

  it("keeps going when one batch fails", async () => {
    vi.mocked(findStaleVideoIds).mockResolvedValue(ids(60));
    vi.mocked(fetchVideosByIds)
      .mockRejectedValueOnce(new Error("quota"))
      .mockResolvedValueOnce(new Map([["v50", video("v50")]]));

    await refreshStaleYoutube();

    expect(notifyError).toHaveBeenCalledTimes(1);
    expect(updateVideoSyncData).toHaveBeenCalledTimes(1);
    expect(updateVideoSyncData).toHaveBeenCalledWith("v50", expect.objectContaining({ title: "Título v50" }));
  });
});
