import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Response } from "express";
import type { DetailCache } from "../models/detailCacheModel.js";

vi.mock("../services/notifyService.js", () => ({ notifyError: vi.fn().mockResolvedValue(undefined) }));

const { serveDetail } = await import("./detailWithCache.js");

function fakeResponse() {
  const headers: Record<string, string> = {};
  const json = vi.fn();
  const res = {
    json,
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
  } as unknown as Response;
  return { res, json, headers };
}

function fakeCache(stored: unknown = null): DetailCache & { save: ReturnType<typeof vi.fn> } {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    markFailure: vi.fn().mockResolvedValue(undefined),
    find: vi.fn().mockResolvedValue(stored),
    findMissing: vi.fn().mockResolvedValue([]),
  } as DetailCache & { save: ReturnType<typeof vi.fn> };
}

describe("serveDetail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("responds with the fresh detail and caches it", async () => {
    const { res, json, headers } = fakeResponse();
    const cache = fakeCache();

    await serveDetail(res, cache, 7, async () => ({ title: "Frieren" }));

    expect(json).toHaveBeenCalledWith({ title: "Frieren" });
    expect(cache.save).toHaveBeenCalledWith(7, ["detail"], { title: "Frieren" });
    expect(headers["X-From-Cache"]).toBeUndefined();
  });

  it("falls back to the cached detail when the external API fails", async () => {
    const { res, json, headers } = fakeResponse();
    const cache = fakeCache({ title: "Frieren (cache)" });

    await serveDetail(res, cache, 7, async () => {
      throw new Error("TMDB fora do ar");
    });

    expect(json).toHaveBeenCalledWith({ title: "Frieren (cache)" });
    expect(headers["X-From-Cache"]).toBe("1");
  });

  it("rethrows when the API fails and there is nothing cached", async () => {
    const { res } = fakeResponse();
    const cache = fakeCache(null);

    await expect(
      serveDetail(res, cache, 7, async () => {
        throw new Error("TMDB fora do ar");
      })
    ).rejects.toThrow("TMDB fora do ar");
  });

  it("uses the given path, so a season caches apart from the series", async () => {
    const { res } = fakeResponse();
    const cache = fakeCache();

    await serveDetail(res, cache, 7, async () => ({ episodes: [] }), ["seasons", "2"]);

    expect(cache.save).toHaveBeenCalledWith(7, ["seasons", "2"], { episodes: [] });
  });

  it("still answers when writing the cache fails", async () => {
    const { res, json } = fakeResponse();
    const cache = fakeCache();
    cache.save.mockRejectedValue(new Error("banco fora"));

    await serveDetail(res, cache, 7, async () => ({ title: "Frieren" }));

    expect(json).toHaveBeenCalledWith({ title: "Frieren" });
  });
});
