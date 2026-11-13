import { describe, it, expect, vi, beforeEach } from "vitest";
import { AxiosError } from "axios";
import type { AxiosResponse } from "axios";
import type { Response } from "express";
import type { DetailCache } from "../models/detailCacheModel.js";

vi.mock("../services/notifyService.js", () => ({ notifyError: vi.fn().mockResolvedValue(undefined) }));

const { serveDetail } = await import("./detailWithCache.js");
const { notifyError } = await import("../services/notifyService.js");

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

  it("reports the failure behind a fallback", async () => {
    const { res } = fakeResponse();

    await serveDetail(res, fakeCache({ title: "Frieren (cache)" }), 7, async () => {
      throw new Error("TMDB fora do ar");
    });

    expect(notifyError).toHaveBeenCalledTimes(1);
  });

  it("answers the cache silently when the item was removed from the external API", async () => {
    const { res, json, headers } = fakeResponse();
    const notFound = new AxiosError("Request failed with status code 404", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 404,
    } as AxiosResponse);

    await serveDetail(res, fakeCache({ title: "Filme apagado" }), 7, async () => {
      throw notFound;
    });

    expect(json).toHaveBeenCalledWith({ title: "Filme apagado" });
    expect(headers["X-From-Cache"]).toBe("1");
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("treats a normalized error wrapping a 404 the same way", async () => {
    const { res } = fakeResponse();
    const notFound = new AxiosError("Request failed with status code 404", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 404,
    } as AxiosResponse);

    await serveDetail(res, fakeCache({ title: "Anime apagado" }), 7, async () => {
      throw new Error("Anime não encontrado na AniList.", { cause: notFound });
    });

    expect(notifyError).not.toHaveBeenCalled();
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
