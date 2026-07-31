import { createContext, useContext, useCallback, useEffect } from "react";

export interface Slice {
  entries: unknown[];
  loading: boolean;
  error: string | null;
  loaded: boolean;
}

export type Store = Record<string, Slice>;

export interface LibraryContextValue {
  store: Store;
  setSlice: (media: string, updater: (prev: Slice) => Slice) => void;
}

export const LibraryContext = createContext<LibraryContextValue | null>(null);

export const EMPTY_SLICE: Slice = { entries: [], loading: true, error: null, loaded: false };

const inFlight = new Set<string>();

let tempSeq = 0;

function mergeServerEntries<T extends { id: string }>(server: T[], local: T[]): T[] {
  const serverIds = new Set(server.map((e) => e.id));
  return [...local.filter((e) => !serverIds.has(e.id)), ...server];
}

export interface LibraryService<TEntry, TCreate, TUpdate> {
  fetchLibrary: () => Promise<TEntry[]>;
  addToLibrary: (entry: TCreate) => Promise<TEntry | TEntry[]>;
  updateLibraryEntry: (id: string, data: TUpdate) => Promise<TEntry>;
  updateManyStatus: (ids: string[], status: string) => Promise<TEntry[]>;
  setCover?: (id: string) => Promise<TEntry>;
  registerAccess?: (id: string) => Promise<TEntry>;
  removeFromLibrary: (id: string) => Promise<void>;
  removeManyFromLibrary: (ids: string[]) => Promise<void>;
}

export interface LibraryStore<TEntry, TCreate, TUpdate> {
  entries: TEntry[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  add: (entry: TCreate) => Promise<TEntry | null>;
  update: (id: string, data: TUpdate) => Promise<TEntry | null>;
  // Primitivo genérico de update otimista com chamada de servidor customizada
  // (ex.: nota por temporada de séries, que bate num endpoint próprio).
  mutate: (id: string, optimistic: Partial<TEntry>, serverCall: () => Promise<TEntry>) => Promise<TEntry | null>;
  updateMany: (ids: string[], status: string) => Promise<boolean>;
  setCover: (id: string) => Promise<TEntry | null>;
  // "Assisti/joguei de novo": só a data de último acesso avança.
  registerAccess: (id: string) => Promise<TEntry | null>;
  remove: (id: string) => Promise<boolean>;
  removeMany: (ids: string[]) => Promise<boolean>;
  findByExternalId: (externalId: number | string) => TEntry | undefined;
}

export function useLibraryStore<TEntry extends { id: string }, TCreate, TUpdate>(
  media: string,
  service: LibraryService<TEntry, TCreate, TUpdate>,
  getExternalId: (entry: TEntry) => number | string,
  getCollectionKey?: (entry: TEntry) => number | null | undefined
): LibraryStore<TEntry, TCreate, TUpdate> {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibraryStore requer o LibraryProvider.");
  const { store, setSlice } = ctx;
  const slice = store[media] ?? EMPTY_SLICE;
  const entries = slice.entries as TEntry[];

  const load = useCallback(async () => {
    setSlice(media, (p) => ({ ...p, loading: true, error: null }));
    try {
      const data = await service.fetchLibrary();
      setSlice(media, (p) => ({ ...p, entries: mergeServerEntries(data, p.entries as TEntry[]), loaded: true, loading: false }));
    } catch {
      setSlice(media, (p) => ({ ...p, error: "Erro ao carregar biblioteca.", loading: false }));
    }
  }, [media, service, setSlice]);

  useEffect(() => {
    if (slice.loaded || inFlight.has(media)) return;
    inFlight.add(media);
    setSlice(media, (p) => ({ ...p, loading: true, error: null }));
    service.fetchLibrary()
      .then((data) => setSlice(media, (p) => ({ ...p, entries: mergeServerEntries(data, p.entries as TEntry[]), loaded: true, loading: false })))
      .catch(() => setSlice(media, (p) => ({ ...p, error: "Erro ao carregar biblioteca.", loading: false })))
      .finally(() => inFlight.delete(media));
  }, [media, slice.loaded, service, setSlice]);

  const add = useCallback(async (entry: TCreate): Promise<TEntry | null> => {
    const tempId = `temp-${++tempSeq}`;
    const optimistic = { id: tempId, ...entry } as unknown as TEntry;
    setSlice(media, (p) => ({ ...p, entries: [optimistic, ...(p.entries as TEntry[])], error: null }));
    try {
      const created = await service.addToLibrary(entry);
      const list = Array.isArray(created) ? created : [created];
      setSlice(media, (p) => {
        const ids = new Set(list.map((e) => e.id));
        const kept = (p.entries as TEntry[]).filter((e) => e.id !== tempId && !ids.has(e.id));
        return { ...p, entries: [...list, ...kept] };
      });
      return list[0] ?? null;
    } catch {
      setSlice(media, (p) => ({ ...p, entries: (p.entries as TEntry[]).filter((e) => e.id !== tempId), error: "Erro ao adicionar à biblioteca." }));
      return null;
    }
  }, [media, service, setSlice]);

  const mutate = useCallback(async (
    id: string,
    optimistic: Partial<TEntry>,
    serverCall: () => Promise<TEntry>
  ): Promise<TEntry | null> => {
    let previous: TEntry | undefined;
    setSlice(media, (p) => {
      const list = p.entries as TEntry[];
      previous = list.find((e) => e.id === id);
      return { ...p, entries: list.map((e) => (e.id === id ? ({ ...e, ...optimistic } as TEntry) : e)), error: null };
    });
    try {
      const updated = await serverCall();
      setSlice(media, (p) => ({ ...p, entries: (p.entries as TEntry[]).map((e) => (e.id === id ? updated : e)) }));
      return updated;
    } catch {
      setSlice(media, (p) => ({ ...p, entries: (p.entries as TEntry[]).map((e) => (e.id === id && previous ? previous : e)), error: "Erro ao atualizar item." }));
      return null;
    }
  }, [media, setSlice]);

  const update = useCallback(
    (id: string, data: TUpdate): Promise<TEntry | null> =>
      mutate(id, data as unknown as Partial<TEntry>, () => service.updateLibraryEntry(id, data)),
    [mutate, service]
  );

  const updateMany = useCallback(async (ids: string[], status: string): Promise<boolean> => {
    if (ids.length === 0) return true;
    const idSet = new Set(ids);
    let snapshot: TEntry[] = [];
    setSlice(media, (p) => {
      snapshot = p.entries as TEntry[];
      return {
        ...p,
        entries: snapshot.map((e) => (idSet.has(e.id) ? ({ ...e, status } as TEntry) : e)),
        error: null,
      };
    });
    try {
      const updated = await service.updateManyStatus(ids, status);
      const byId = new Map(updated.map((e) => [e.id, e]));
      setSlice(media, (p) => ({ ...p, entries: (p.entries as TEntry[]).map((e) => byId.get(e.id) ?? e) }));
      return true;
    } catch {
      setSlice(media, (p) => ({ ...p, entries: snapshot, error: "Erro ao atualizar itens." }));
      return false;
    }
  }, [media, service, setSlice]);

  const setCover = useCallback(async (id: string): Promise<TEntry | null> => {
    if (!service.setCover) return null;
    let snapshot: TEntry[] = [];
    setSlice(media, (p) => {
      const list = p.entries as TEntry[];
      snapshot = list;
      const target = list.find((e) => e.id === id);
      const key = target && getCollectionKey ? getCollectionKey(target) : undefined;
      return {
        ...p,
        entries: list.map((e) => {
          if (e.id === id) return { ...e, isCover: true } as TEntry;
          if (key != null && getCollectionKey && getCollectionKey(e) === key) return { ...e, isCover: false } as TEntry;
          return e;
        }),
        error: null,
      };
    });
    try {
      const updated = await service.setCover(id);
      setSlice(media, (p) => ({ ...p, entries: (p.entries as TEntry[]).map((e) => (e.id === id ? updated : e)) }));
      return updated;
    } catch {
      setSlice(media, (p) => ({ ...p, entries: snapshot, error: "Erro ao definir capa da coleção." }));
      return null;
    }
  }, [media, service, setSlice, getCollectionKey]);

  // A data é NOW() dos dois lados, então o patch otimista já é o valor final.
  const registerAccess = useCallback(async (id: string): Promise<TEntry | null> => {
    if (!service.registerAccess) return null;
    const lastAccessAt = new Date().toISOString();
    return mutate(id, { lastAccessAt } as unknown as Partial<TEntry>, () => service.registerAccess!(id));
  }, [mutate, service]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    let removed: TEntry | undefined;
    let index = -1;
    setSlice(media, (p) => {
      const list = p.entries as TEntry[];
      index = list.findIndex((e) => e.id === id);
      removed = list[index];
      return { ...p, entries: list.filter((e) => e.id !== id), error: null };
    });
    try {
      await service.removeFromLibrary(id);
      return true;
    } catch {
      setSlice(media, (p) => {
        if (!removed) return { ...p, error: "Erro ao remover da biblioteca." };
        const list = [...(p.entries as TEntry[])];
        list.splice(index >= 0 ? index : list.length, 0, removed);
        return { ...p, entries: list, error: "Erro ao remover da biblioteca." };
      });
      return false;
    }
  }, [media, service, setSlice]);

  const removeMany = useCallback(async (ids: string[]): Promise<boolean> => {
    if (ids.length === 0) return true;
    const idSet = new Set(ids);
    let snapshot: TEntry[] = [];
    setSlice(media, (p) => {
      snapshot = p.entries as TEntry[];
      return { ...p, entries: snapshot.filter((e) => !idSet.has(e.id)), error: null };
    });
    try {
      await service.removeManyFromLibrary(ids);
      return true;
    } catch {
      setSlice(media, (p) => ({ ...p, entries: snapshot, error: "Erro ao remover da biblioteca." }));
      return false;
    }
  }, [media, service, setSlice]);

  const findByExternalId = useCallback(
    (externalId: number | string): TEntry | undefined => entries.find((e) => getExternalId(e) === externalId),
    [entries, getExternalId]
  );

  return { entries, loading: slice.loading, error: slice.error, load, add, update, mutate, updateMany, setCover, registerAccess, remove, removeMany, findByExternalId };
}
