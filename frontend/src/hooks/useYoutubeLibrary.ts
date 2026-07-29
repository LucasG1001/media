import { useCallback } from "react";
import { useLibraryStore } from "../context/libraryStore";
import * as youtubeLibraryService from "../services/youtubeLibraryService";
import type {
  YoutubeLibraryEntry,
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
    async (url: string) => {
      const result = await youtubeLibraryService.addFromUrl(url);
      await load();
      return result;
    },
    [load]
  );

  const addTagMany = useCallback(
    async (ids: string[], tag: string) => {
      await youtubeLibraryService.addTagMany(ids, tag);
      await load();
    },
    [load]
  );

  const removeTagMany = useCallback(
    async (ids: string[], tag: string) => {
      await youtubeLibraryService.removeTagMany(ids, tag);
      await load();
    },
    [load]
  );

  return {
    ...store,
    findByVideoId: store.findByExternalId,
    addFromUrl,
    addTagMany,
    removeTagMany,
  };
}
