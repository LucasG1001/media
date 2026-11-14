import { useCallback } from "react";
import { useLibraryStore } from "../context/libraryStore";
import * as youtubeLibraryService from "../services/youtubeLibraryService";
import type {
  YoutubeLibraryEntry,
  YoutubeKind,
  CreateYoutubeLibraryEntry,
  UpdateYoutubeLibraryEntry,
} from "../types/youtubeLibrary";

export function useYoutubeLibrary() {
  const store = useLibraryStore<YoutubeLibraryEntry, CreateYoutubeLibraryEntry, UpdateYoutubeLibraryEntry>(
    "youtube",
    youtubeLibraryService,
    (entry) => entry.videoId
  );

  const { load } = store;

  const addFromUrl = useCallback(
    async (url: string, kind: YoutubeKind) => {
      const result = await youtubeLibraryService.addFromUrl(url, kind);
      await load();
      return result;
    },
    [load]
  );

  return {
    ...store,
    findByVideoId: store.findByExternalId,
    addFromUrl,
  };
}
