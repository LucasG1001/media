import { describe, it, expect } from "vitest";
import {
  movieCreateSchema,
  gameCreateSchema,
  bookCreateSchema,
  animeCreateSchema,
  seriesUpdateSchema,
  youtubeCreateSchema,
  youtubeUpdateSchema,
  youtubeFromUrlSchema,
  youtubePlaylistCreateSchema,
  youtubePlaylistRenameSchema,
  youtubePlaylistItemsSchema,
  youtubePlaylistIdSchema,
} from "./library.js";

const ENTRY_ID = "3f2b1c9e-6a4d-4e8b-9c1f-0a2b3c4d5e6f";

describe("youtube playlist schemas", () => {
  it("accepts a playlist of each kind, with or without items", () => {
    expect(youtubePlaylistCreateSchema.parse({ name: "Treino", kind: "music" })).toEqual({
      name: "Treino",
      kind: "music",
    });
    expect(
      youtubePlaylistCreateSchema.safeParse({ name: "Aulas", kind: "video", entryIds: [ENTRY_ID] }).success
    ).toBe(true);
  });

  // A playlist é de uma aba: sem `kind` não dá para saber de qual.
  it("requires the kind and a non-blank name", () => {
    expect(youtubePlaylistCreateSchema.safeParse({ name: "Treino" }).success).toBe(false);
    expect(youtubePlaylistCreateSchema.safeParse({ name: "   ", kind: "music" }).success).toBe(false);
    expect(youtubePlaylistRenameSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("trims the name", () => {
    expect(youtubePlaylistRenameSchema.parse({ name: "  Foco  " })).toEqual({ name: "Foco" });
  });

  // Id temporário do cliente (`temp-1`) estouraria o cast para uuid no banco.
  it("rejects ids that are not uuids and an empty item list", () => {
    expect(youtubePlaylistItemsSchema.safeParse({ entryIds: ["temp-1"] }).success).toBe(false);
    expect(youtubePlaylistItemsSchema.safeParse({ entryIds: [] }).success).toBe(false);
    expect(youtubePlaylistItemsSchema.safeParse({ entryIds: [ENTRY_ID] }).success).toBe(true);
    expect(youtubePlaylistIdSchema.safeParse("playlists").success).toBe(false);
    expect(youtubePlaylistIdSchema.safeParse(ENTRY_ID).success).toBe(true);
  });
});

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

describe("youtube schemas", () => {
  it("accepts a valid payload for each kind", () => {
    expect(youtubeCreateSchema.safeParse({ videoId: "abc", title: "X", kind: "music" }).success).toBe(true);
    expect(youtubeCreateSchema.safeParse({ videoId: "abc", title: "X", kind: "video" }).success).toBe(true);
  });

  it("only knows the liked/removed statuses and the music/video kinds", () => {
    expect(youtubeCreateSchema.safeParse({ videoId: "abc", title: "X", status: "watched" }).success).toBe(false);
    expect(youtubeCreateSchema.safeParse({ videoId: "abc", title: "X", kind: "podcast" }).success).toBe(false);
  });

  // Mover um item de aba é um update de `kind`, sem endpoint próprio.
  it("lets an update change only the kind", () => {
    expect(youtubeUpdateSchema.parse({ kind: "music" })).toEqual({ kind: "music" });
  });

  // Coleções e tags foram removidas: o campo é descartado em vez de chegar ao model.
  it("drops tags and collection fields", () => {
    const parsed = youtubeUpdateSchema.parse({ notes: "n", tags: ["rock"], collectionId: 3 });
    expect(parsed).toEqual({ notes: "n" });
  });

  it("takes the kind of the tab the link was pasted in", () => {
    expect(youtubeFromUrlSchema.parse({ url: "u", kind: "music" })).toEqual({ url: "u", kind: "music" });
    expect(youtubeFromUrlSchema.parse({ url: "u" })).toEqual({ url: "u" });
    expect(youtubeFromUrlSchema.safeParse({ url: "u", kind: "x" }).success).toBe(false);
  });
});
