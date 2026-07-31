import { useState, useEffect, useCallback, useMemo } from "react";
import * as youtubeLibraryService from "../services/youtubeLibraryService";
import type { YoutubeCollection } from "../types/youtubeLibrary";

export function useYoutubeCollections() {
  const [collections, setCollections] = useState<YoutubeCollection[]>([]);

  const reload = useCallback(async () => {
    try {
      setCollections(await youtubeLibraryService.listCollections());
    } catch {
      /* silencioso: coleções são um detalhe secundário */
    }
  }, []);

  useEffect(() => {
    let active = true;
    youtubeLibraryService
      .listCollections()
      .then((data) => {
        if (active) setCollections(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const byId = useMemo(() => {
    const map = new Map<number, string>();
    for (const collection of collections) map.set(collection.id, collection.name);
    return map;
  }, [collections]);

  const rename = useCallback(
    async (id: number, name: string) => {
      await youtubeLibraryService.renameCollection(id, name);
      await reload();
    },
    [reload]
  );

  return { collections, byId, reload, rename };
}
