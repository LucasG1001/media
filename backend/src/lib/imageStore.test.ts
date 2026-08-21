import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { hashUrl, imagePath, isAllowedImageUrl, removeImage, statCached, storeImage } from "./imageStore.js";

const TMDB = "https://image.tmdb.org/t/p/w500/abc.jpg";

describe("imageStore.isAllowedImageUrl", () => {
  it("accepts the CDNs the app actually renders", () => {
    expect(isAllowedImageUrl(TMDB)).toBe(true);
    expect(isAllowedImageUrl("https://s4.anilist.co/file/anilistcdn/a.jpg")).toBe(true);
    expect(isAllowedImageUrl("https://images.igdb.com/igdb/image/upload/t_cover_big/co.jpg")).toBe(true);
    expect(isAllowedImageUrl("https://assets.hardcover.app/x.png")).toBe(true);
    expect(isAllowedImageUrl("https://i.ytimg.com/vi/x/maxres.jpg")).toBe(true);
  });

  it("rejects anything outside the allowlist", () => {
    expect(isAllowedImageUrl("https://evil.example.com/a.jpg")).toBe(false);
    expect(isAllowedImageUrl("http://localhost/a.jpg")).toBe(false);
    expect(isAllowedImageUrl("http://127.0.0.1/a.jpg")).toBe(false);
    expect(isAllowedImageUrl("file:///etc/passwd")).toBe(false);
    expect(isAllowedImageUrl("not a url")).toBe(false);
  });

  it("rejects a lookalike host that only ends with the suffix as a substring", () => {
    expect(isAllowedImageUrl("https://notimage.tmdb.org.evil.com/a.jpg")).toBe(false);
    expect(isAllowedImageUrl("https://eviltmdb.org/a.jpg")).toBe(false);
  });

  it("rejects an explicit port even on an allowed host", () => {
    expect(isAllowedImageUrl("https://image.tmdb.org:8080/a.jpg")).toBe(false);
  });

  it("honours IMAGE_EXTRA_HOSTS", () => {
    expect(isAllowedImageUrl("https://cdn.example.com/a.jpg")).toBe(false);
    process.env.IMAGE_EXTRA_HOSTS = "example.com";
    expect(isAllowedImageUrl("https://cdn.example.com/a.jpg")).toBe(true);
    delete process.env.IMAGE_EXTRA_HOSTS;
  });
});

describe("imageStore.hashUrl", () => {
  it("is stable and distinguishes URLs", () => {
    expect(hashUrl(TMDB)).toBe(hashUrl(TMDB));
    expect(hashUrl(TMDB)).toHaveLength(64);
    expect(hashUrl(TMDB)).not.toBe(hashUrl(`${TMDB}?x=1`));
  });
});

describe("imageStore disk layout", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "img-store-"));
    process.env.IMAGE_CACHE_DIR = dir;
  });

  afterEach(async () => {
    delete process.env.IMAGE_CACHE_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it("stores under a two-char shard and reads back the bytes", async () => {
    const hash = hashUrl(TMDB);
    await storeImage(hash, Buffer.from("bytes"));

    expect(imagePath(hash)).toBe(path.join(dir, hash.slice(0, 2), hash));
    expect(await statCached(hash)).toBe(5);
    expect(await readFile(imagePath(hash), "utf8")).toBe("bytes");
  });

  it("leaves no temporary file behind", async () => {
    const hash = hashUrl(TMDB);
    await storeImage(hash, Buffer.from("bytes"));
    const files = await readdir(path.join(dir, hash.slice(0, 2)));
    expect(files).toEqual([hash]);
  });

  it("overwrites an existing entry", async () => {
    const hash = hashUrl(TMDB);
    await storeImage(hash, Buffer.from("old"));
    await storeImage(hash, Buffer.from("newer"));
    expect(await readFile(imagePath(hash), "utf8")).toBe("newer");
  });

  it("reports a miss for an unknown hash and tolerates removing it", async () => {
    expect(await statCached(hashUrl("https://image.tmdb.org/t/p/w500/nope.jpg"))).toBeNull();
    await expect(removeImage(hashUrl("https://image.tmdb.org/t/p/w500/nope.jpg"))).resolves.toBeUndefined();
  });

  it("removes a stored file", async () => {
    const hash = hashUrl(TMDB);
    await storeImage(hash, Buffer.from("bytes"));
    await removeImage(hash);
    expect(await statCached(hash)).toBeNull();
  });
});
