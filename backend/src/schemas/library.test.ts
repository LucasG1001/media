import { describe, it, expect } from "vitest";
import {
  movieCreateSchema,
  gameCreateSchema,
  bookCreateSchema,
  animeCreateSchema,
  seriesUpdateSchema,
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
