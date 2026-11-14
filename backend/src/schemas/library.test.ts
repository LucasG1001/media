import { describe, it, expect } from "vitest";
import {
  movieCreateSchema,
  gameCreateSchema,
  bookCreateSchema,
  animeCreateSchema,
  seriesUpdateSchema,
  musicCreateSchema,
  musicUpdateSchema,
  youtubeMoveToMusicSchema,
} from "./library.js";

describe("library schemas", () => {
  it("accepts a valid movie payload", () => {
    expect(movieCreateSchema.safeParse({ tmdbId: 1, title: "X", score: 8 }).success).toBe(true);
  });

  it("rejects score out of range", () => {
    expect(movieCreateSchema.safeParse({ tmdbId: 1, title: "X", score: 99 }).success).toBe(false);
  });

  it("rejects an invalid status", () => {
    expect(gameCreateSchema.safeParse({ igdbId: 1, title: "X", status: "nope" }).success).toBe(false);
  });

  it("requires a non-empty title", () => {
    expect(bookCreateSchema.safeParse({ hardcoverId: 1 }).success).toBe(false);
  });

  it("accepts a valid anime payload with unknown JSONB fields", () => {
    const result = animeCreateSchema.safeParse({
      anilistId: 1,
      title: "X",
      status: "watched",
      nextAiringEpisode: { episode: 5, airingAt: 123 },
      streamingLinks: [{ url: "u" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts the rewatch status of each media", () => {
    expect(animeCreateSchema.safeParse({ anilistId: 1, title: "X", status: "rewatching" }).success).toBe(true);
    expect(movieCreateSchema.safeParse({ tmdbId: 1, title: "X", status: "rewatching" }).success).toBe(true);
    expect(seriesUpdateSchema.safeParse({ status: "rewatching" }).success).toBe(true);
    expect(gameCreateSchema.safeParse({ igdbId: 1, title: "X", status: "replaying" }).success).toBe(true);
    expect(bookCreateSchema.safeParse({ hardcoverId: 1, title: "X", status: "rereading" }).success).toBe(true);
  });

  it("does not accept another media's rewatch status", () => {
    expect(gameCreateSchema.safeParse({ igdbId: 1, title: "X", status: "rewatching" }).success).toBe(false);
    expect(bookCreateSchema.safeParse({ hardcoverId: 1, title: "X", status: "replaying" }).success).toBe(false);
  });
});

describe("music schemas", () => {
  it("accepts a valid music payload", () => {
    expect(musicCreateSchema.safeParse({ videoId: "abc", title: "X", status: "liked" }).success).toBe(true);
  });

  it("only knows the liked/removed statuses", () => {
    expect(musicCreateSchema.safeParse({ videoId: "abc", title: "X", status: "watched" }).success).toBe(false);
  });

  // Sem coleção não há tag: o campo é descartado em vez de chegar ao model.
  it("drops tags from create and update", () => {
    const created = musicCreateSchema.parse({ videoId: "abc", title: "X", tags: ["rock"] });
    expect(created).not.toHaveProperty("tags");
    const updated = musicUpdateSchema.parse({ notes: "n", tags: ["rock"] });
    expect(updated).toEqual({ notes: "n" });
  });

  it("requires at least one id to move from YouTube", () => {
    expect(youtubeMoveToMusicSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(youtubeMoveToMusicSchema.safeParse({ ids: ["uuid-1"] }).success).toBe(true);
  });
});
