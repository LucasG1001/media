import { describe, it, expect, vi, beforeEach } from "vitest";

const downloadImage = vi.fn();
const storeImage = vi.fn();
const statCached = vi.fn();
const findImageCache = vi.fn();
const saveImageCache = vi.fn();
const markImageFailure = vi.fn();
const touchImageHit = vi.fn();

vi.mock("../lib/imageStore.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/imageStore.js")>("../lib/imageStore.js");
  return { ...actual, downloadImage, storeImage, statCached };
});

vi.mock("../models/imageCacheModel.js", () => ({
  findImageCache,
  saveImageCache,
  markImageFailure,
  touchImageHit,
}));

const { getCachedImage } = await import("./imageCacheService.js");

const URL_A = "https://image.tmdb.org/t/p/w500/a.jpg";

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("imageCacheService.getCachedImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findImageCache.mockResolvedValue(null);
    statCached.mockResolvedValue(null);
    saveImageCache.mockResolvedValue(undefined);
    markImageFailure.mockResolvedValue(undefined);
    touchImageHit.mockResolvedValue(undefined);
    storeImage.mockResolvedValue(undefined);
  });

  it("refuses a host outside the allowlist without touching the network", async () => {
    expect(await getCachedImage("https://evil.example.com/a.jpg")).toBeNull();
    expect(downloadImage).not.toHaveBeenCalled();
  });

  it("serves from disk without downloading when file and metadata exist", async () => {
    findImageCache.mockResolvedValue({ urlHash: "h", url: URL_A, contentType: "image/jpeg", bytes: 10 });
    statCached.mockResolvedValue(10);

    const result = await getCachedImage(URL_A);

    expect(result?.contentType).toBe("image/jpeg");
    expect(downloadImage).not.toHaveBeenCalled();
    expect(touchImageHit).toHaveBeenCalledOnce();
  });

  it("re-downloads when the row exists but the file is gone", async () => {
    findImageCache.mockResolvedValue({ urlHash: "h", url: URL_A, contentType: "image/jpeg", bytes: 10 });
    statCached.mockResolvedValue(null);
    downloadImage.mockResolvedValue({ buffer: Buffer.from("x"), contentType: "image/jpeg" });

    expect(await getCachedImage(URL_A)).not.toBeNull();
    expect(downloadImage).toHaveBeenCalledOnce();
    expect(storeImage).toHaveBeenCalledOnce();
  });

  it("downloads a concurrent burst only once", async () => {
    const gate = deferred<{ buffer: Buffer; contentType: string }>();
    downloadImage.mockReturnValue(gate.promise);

    const burst = Promise.all(Array.from({ length: 20 }, () => getCachedImage(URL_A)));
    gate.resolve({ buffer: Buffer.from("x"), contentType: "image/png" });
    const results = await burst;

    expect(downloadImage).toHaveBeenCalledOnce();
    expect(saveImageCache).toHaveBeenCalledOnce();
    expect(results.every((r) => r?.contentType === "image/png")).toBe(true);
  });

  it("records the failure and stops retrying within the backoff window", async () => {
    const url = "https://image.tmdb.org/t/p/w500/broken.jpg";
    downloadImage.mockRejectedValue(new Error("404"));

    expect(await getCachedImage(url)).toBeNull();
    expect(markImageFailure).toHaveBeenCalledOnce();

    expect(await getCachedImage(url)).toBeNull();
    expect(downloadImage).toHaveBeenCalledOnce();
  });
});
