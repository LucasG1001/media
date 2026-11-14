import { describe, it, expect } from "vitest";
import { youtubeRowsFromBackup } from "./backupLegacy.js";

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
