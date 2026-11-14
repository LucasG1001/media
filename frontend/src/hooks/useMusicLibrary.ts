import { useCallback } from "react";
import { useLibraryStore } from "../context/libraryStore";
import * as musicLibraryService from "../services/musicLibraryService";
import type {
  MusicLibraryEntry,
  CreateMusicLibraryEntry,
  UpdateMusicLibraryEntry,
} from "../types/musicLibrary";

export const MUSIC_STORE_KEY = "music";

export function useMusicLibrary() {
  const store = useLibraryStore<MusicLibraryEntry, CreateMusicLibraryEntry, UpdateMusicLibraryEntry>(
    MUSIC_STORE_KEY,
    musicLibraryService,
    (entry) => entry.videoId
  );

  const { load } = store;

  const addFromUrl = useCallback(
    async (url: string) => {
      const result = await musicLibraryService.addFromUrl(url);
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
