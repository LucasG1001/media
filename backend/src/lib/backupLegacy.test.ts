import { describe, it, expect } from "vitest";
import { youtubeRowsFromBackup, youtubePlaylistsFromBackup } from "./backupLegacy.js";

describe("youtubePlaylistsFromBackup", () => {
  it("keeps name, kind and the video ids in order", () => {
    const playlists = youtubePlaylistsFromBackup({
      youtubePlaylists: [{ name: "Treino", kind: "music", videoIds: ["c", "a", "b"] }],
    });
    expect(playlists).toEqual([{ name: "Treino", kind: "music", videoIds: ["c", "a", "b"] }]);
  });

  // Arquivo de antes das playlists não tem a chave.
  it("returns nothing for a backup without playlists", () => {
    expect(youtubePlaylistsFromBackup({ youtube: [{ videoId: "a" }] })).toEqual([]);
    expect(youtubePlaylistsFromBackup({ youtubePlaylists: "oops" })).toEqual([]);
  });

  it("drops playlists without a name or with an unknown kind", () => {
    const playlists = youtubePlaylistsFromBackup({
      youtubePlaylists: [
        { name: "  ", kind: "music", videoIds: ["a"] },
        { kind: "video", videoIds: ["a"] },
        { name: "Podcast", kind: "podcast", videoIds: ["a"] },
        { name: " Ok ", kind: "video", videoIds: ["a"] },
      ],
    });
    expect(playlists).toEqual([{ name: "Ok", kind: "video", videoIds: ["a"] }]);
  });

  it("keeps an empty playlist and ignores ids that are not text", () => {
    const playlists = youtubePlaylistsFromBackup({
      youtubePlaylists: [
        { name: "Vazia", kind: "video" },
        { name: "Suja", kind: "video", videoIds: ["a", 3, null, "", "b"] },
      ],
    });
    expect(playlists).toEqual([
      { name: "Vazia", kind: "video", videoIds: [] },
      { name: "Suja", kind: "video", videoIds: ["a", "b"] },
    ]);
  });
});

describe("youtubeRowsFromBackup", () => {
  it("keeps the kind of rows exported after the merge", () => {
    const rows = youtubeRowsFromBackup({
      youtube: [
        { videoId: "a", kind: "music" },
        { videoId: "b", kind: "video" },
      ],
    });
    expect(rows).toEqual([
      { videoId: "a", kind: "music" },
      { videoId: "b", kind: "video" },
    ]);
  });

  // Antes da fusão a chave `youtube` só tinha vídeos, sem `kind`.
  it("treats youtube rows without kind as videos", () => {
    expect(youtubeRowsFromBackup({ youtube: [{ videoId: "a" }] })).toEqual([{ videoId: "a", kind: "video" }]);
  });

  it("imports the legacy music key as music", () => {
    expect(youtubeRowsFromBackup({ music: [{ videoId: "m", notes: "n" }] })).toEqual([
      { videoId: "m", notes: "n", kind: "music" },
    ]);
  });

  // O upsert é por video_id e a última linha vence: a música tem que vir depois.
  it("puts legacy music after the videos so it wins a duplicated video", () => {
    const rows = youtubeRowsFromBackup({
      music: [{ videoId: "dup", title: "música" }],
      youtube: [{ videoId: "dup", title: "vídeo" }],
    });
    expect(rows.map((row) => row.kind)).toEqual(["video", "music"]);
  });

  it("ignores the legacy collections and anything that is not a list", () => {
    expect(youtubeRowsFromBackup({ youtubeCollections: [{ id: 1, name: "x" }], youtube: "oops" })).toEqual([]);
  });
});
