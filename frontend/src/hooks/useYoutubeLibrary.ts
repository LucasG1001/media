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
    (entry) => entry.videoId,
    (entry) => entry.collectionId
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

  const formGroup = useCallback(
    async (ids: string[], name: string) => {
      const collection = await youtubeLibraryService.formGroup(ids, name);
      await load();
      return collection;
    },
    [load]
  );

  const addToGroup = useCallback(
    async (ids: string[], collectionId: number) => {
      await youtubeLibraryService.addToGroup(ids, collectionId);
      await load();
    },
    [load]
  );

  const removeFromGroup = useCallback(
    async (ids: string[]) => {
      await youtubeLibraryService.removeFromGroup(ids);
      await load();
    },
    [load]
  );

  const setTagMany = useCallback(
    async (ids: string[], tag: string | null) => {
      await youtubeLibraryService.setTagMany(ids, tag);
      await load();
    },
    [load]
  );

  return {
    ...store,
    findByVideoId: store.findByExternalId,
    addFromUrl,
    formGroup,
    addToGroup,
    removeFromGroup,
    setTagMany,
  };
}
