import { useCallback, useEffect, useRef, useState } from "react";
import * as playlistService from "../services/youtubePlaylistService";
import { failureMessage } from "../services/api";
import type { YoutubeKind, YoutubePlaylist } from "../types/youtubeLibrary";

type Patch = (list: YoutubePlaylist[]) => YoutubePlaylist[];

// As playlists do YouTube, com o mesmo contrato otimista das bibliotecas: a tela
// muda na hora e volta atrás se o servidor recusar. Só `create` espera a
// resposta, porque é ela que traz o id.
export function useYoutubePlaylists() {
  const [playlists, setPlaylists] = useState<YoutubePlaylist[]>([]);
  const [error, setError] = useState<string | null>(null);
  // A lista corrente, lida de forma síncrona. O snapshot do rollback não pode
  // sair de dentro de um updater do setState: o React pode rodá-lo só no próximo
  // render, e uma falha rápida restauraria um snapshot que ainda não existe.
  const latest = useRef<YoutubePlaylist[]>([]);

  const commit = useCallback((next: YoutubePlaylist[]) => {
    latest.current = next;
    setPlaylists(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    playlistService
      .fetchPlaylists()
      .then((data) => {
        if (!cancelled) commit(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(failureMessage(e, "Erro ao carregar playlists."));
      });
    return () => {
      cancelled = true;
    };
  }, [commit]);

  const mutate = useCallback(
    async (optimistic: Patch, serverCall: () => Promise<YoutubePlaylist | void>, fallback: string): Promise<boolean> => {
      const snapshot = latest.current;
      commit(optimistic(snapshot));
      setError(null);
      try {
        const saved = await serverCall();
        if (saved) commit(latest.current.map((p) => (p.id === saved.id ? saved : p)));
        return true;
      } catch (e) {
        commit(snapshot);
        setError(failureMessage(e, fallback));
        return false;
      }
    },
    [commit]
  );

  const create = useCallback(
    async (name: string, kind: YoutubeKind, entryIds: string[]): Promise<YoutubePlaylist | null> => {
      setError(null);
      try {
        const created = await playlistService.createPlaylist(name, kind, entryIds);
        commit([...latest.current.filter((p) => p.id !== created.id), created]);
        return created;
      } catch (e) {
        setError(failureMessage(e, "Erro ao criar playlist."));
        return null;
      }
    },
    [commit]
  );

  const rename = useCallback(
    (id: string, name: string) =>
      mutate(
        (list) => list.map((p) => (p.id === id ? { ...p, name } : p)),
        () => playlistService.renamePlaylist(id, name),
        "Erro ao renomear playlist."
      ),
    [mutate]
  );

  const remove = useCallback(
    (id: string) =>
      mutate(
        (list) => list.filter((p) => p.id !== id),
        () => playlistService.deletePlaylist(id),
        "Erro ao excluir playlist."
      ),
    [mutate]
  );

  // Quem já está na playlist fica onde está; os novos entram no fim, na ordem
  // recebida — a mesma regra do servidor.
  const addItems = useCallback(
    (id: string, entryIds: string[]) =>
      mutate(
        (list) =>
          list.map((p) =>
            p.id === id ? { ...p, itemIds: [...new Set([...p.itemIds, ...entryIds])] } : p
          ),
        () => playlistService.addPlaylistItems(id, entryIds),
        "Erro ao adicionar à playlist."
      ),
    [mutate]
  );

  const removeItems = useCallback(
    (id: string, entryIds: string[]) =>
      mutate(
        (list) =>
          list.map((p) => (p.id === id ? { ...p, itemIds: p.itemIds.filter((e) => !entryIds.includes(e)) } : p)),
        () => playlistService.removePlaylistItems(id, entryIds),
        "Erro ao tirar da playlist."
      ),
    [mutate]
  );

  return { playlists, error, create, rename, remove, addItems, removeItems };
}
