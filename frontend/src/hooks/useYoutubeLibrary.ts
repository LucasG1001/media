import { useCallback, useContext } from "react";
import { useLibraryStore, LibraryContext } from "../context/libraryStore";
import { MUSIC_STORE_KEY } from "./useMusicLibrary";
import * as youtubeLibraryService from "../services/youtubeLibraryService";
import type {
  YoutubeLibraryEntry,
  CreateYoutubeLibraryEntry,
  UpdateYoutubeLibraryEntry,
} from "../types/youtubeLibrary";

const YOUTUBE_STORE_KEY = "youtube";

export function useYoutubeLibrary() {
  const setSlice = useContext(LibraryContext)?.setSlice;
  const store = useLibraryStore<YoutubeLibraryEntry, CreateYoutubeLibraryEntry, UpdateYoutubeLibraryEntry>(
    YOUTUBE_STORE_KEY,
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

  // O `load` faz merge e mantém o que só existe localmente, então quem saiu do
  // YouTube é tirado do slice à mão. O slice de Música só é marcado como não
  // carregado: ele rebusca na próxima vez que a página montar.
  const moveToMusic = useCallback(
    async (ids: string[]) => {
      const moved = await youtubeLibraryService.moveToMusic(ids);
      const gone = new Set(ids);
      setSlice?.(YOUTUBE_STORE_KEY, (prev) => ({
        ...prev,
        entries: (prev.entries as YoutubeLibraryEntry[]).filter((entry) => !gone.has(entry.id)),
      }));
      setSlice?.(MUSIC_STORE_KEY, (prev) => ({ ...prev, loaded: false }));
      return moved;
    },
    [setSlice]
  );

  return {
    ...store,
    findByVideoId: store.findByExternalId,
    addFromUrl,
    moveToMusic,
    addTagMany,
    removeTagMany,
    formGroup,
    addToGroup,
    removeFromGroup,
  };
}
