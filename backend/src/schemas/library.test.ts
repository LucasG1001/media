import { describe, it, expect } from "vitest";
import { movieCreateSchema, gameCreateSchema, bookCreateSchema, animeCreateSchema } from "./library.js";

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
});
