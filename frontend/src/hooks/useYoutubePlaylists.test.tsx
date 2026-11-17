import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor, cleanup } from "@testing-library/react";
import { useYoutubePlaylists } from "./useYoutubePlaylists";
import * as playlistService from "../services/youtubePlaylistService";
import type { YoutubePlaylist } from "../types/youtubeLibrary";

vi.mock("../services/youtubePlaylistService");

const service = vi.mocked(playlistService);

const TREINO: YoutubePlaylist = { id: "pl-1", name: "Treino", kind: "music", itemIds: ["a"] };
const FOCO: YoutubePlaylist = { id: "pl-2", name: "Foco", kind: "music", itemIds: [] };

async function mounted() {
  const view = renderHook(() => useYoutubePlaylists());
  await waitFor(() => expect(view.result.current.playlists).toHaveLength(2));
  return view;
}

function itemsOf(view: Awaited<ReturnType<typeof mounted>>, id: string): string[] | undefined {
  return view.result.current.playlists.find((playlist) => playlist.id === id)?.itemIds;
}

beforeEach(() => {
  vi.resetAllMocks();
  service.fetchPlaylists.mockResolvedValue([TREINO, FOCO]);
});

afterEach(cleanup);

describe("useYoutubePlaylists", () => {
  it("carrega as playlists ao montar", async () => {
    const view = await mounted();
    expect(view.result.current.playlists.map((playlist) => playlist.name)).toEqual(["Treino", "Foco"]);
    expect(view.result.current.error).toBeNull();
  });

  it("guarda o erro quando o carregamento falha", async () => {
    service.fetchPlaylists.mockRejectedValue(new Error("caiu"));
    const view = renderHook(() => useYoutubePlaylists());
    await waitFor(() => expect(view.result.current.error).toBe("Erro ao carregar playlists."));
    expect(view.result.current.playlists).toEqual([]);
  });

  // Otimista: a tela muda antes da resposta, e depois fica com o que o servidor devolveu.
  it("adiciona itens na hora, sem repetir quem já estava, e fica com a resposta do servidor", async () => {
    let resolve!: (playlist: YoutubePlaylist) => void;
    service.addPlaylistItems.mockReturnValue(new Promise((done) => { resolve = done; }));
    const view = await mounted();

    let pending!: Promise<boolean>;
    act(() => {
      pending = view.result.current.addItems("pl-1", ["a", "b", "c"]);
    });
    expect(itemsOf(view, "pl-1")).toEqual(["a", "b", "c"]);

    await act(async () => {
      resolve({ ...TREINO, itemIds: ["a", "c", "b"] });
      expect(await pending).toBe(true);
    });
    expect(service.addPlaylistItems).toHaveBeenCalledWith("pl-1", ["a", "b", "c"]);
    expect(itemsOf(view, "pl-1")).toEqual(["a", "c", "b"]);
  });

  it("desfaz e guarda o erro quando o servidor recusa", async () => {
    service.addPlaylistItems.mockRejectedValue(new Error("caiu"));
    const view = await mounted();
    await act(async () => {
      expect(await view.result.current.addItems("pl-1", ["b"])).toBe(false);
    });
    expect(itemsOf(view, "pl-1")).toEqual(["a"]);
    expect(view.result.current.error).toBe("Erro ao adicionar à playlist.");
  });

  it("tira itens da playlist", async () => {
    service.removePlaylistItems.mockResolvedValue({ ...TREINO, itemIds: [] });
    const view = await mounted();
    await act(async () => {
      await view.result.current.removeItems("pl-1", ["a"]);
    });
    expect(itemsOf(view, "pl-1")).toEqual([]);
    expect(itemsOf(view, "pl-2")).toEqual([]);
  });

  it("renomeia e exclui", async () => {
    service.renamePlaylist.mockResolvedValue({ ...TREINO, name: "Academia" });
    service.deletePlaylist.mockResolvedValue(undefined);
    const view = await mounted();
    await act(async () => {
      await view.result.current.rename("pl-1", "Academia");
      await view.result.current.remove("pl-2");
    });
    expect(view.result.current.playlists.map((playlist) => playlist.name)).toEqual(["Academia"]);
  });

  it("a exclusão recusada devolve a playlist", async () => {
    service.deletePlaylist.mockRejectedValue(new Error("caiu"));
    const view = await mounted();
    await act(async () => {
      expect(await view.result.current.remove("pl-2")).toBe(false);
    });
    expect(view.result.current.playlists).toHaveLength(2);
  });

  // Criar espera o servidor: é a resposta que traz o id.
  it("cria e devolve a playlist nova; em erro devolve null e não inventa nada", async () => {
    const nova: YoutubePlaylist = { id: "pl-3", name: "Viagem", kind: "video", itemIds: ["x"] };
    service.createPlaylist.mockResolvedValueOnce(nova).mockRejectedValueOnce(new Error("caiu"));
    const view = await mounted();

    await act(async () => {
      expect(await view.result.current.create("Viagem", "video", ["x"])).toEqual(nova);
    });
    expect(service.createPlaylist).toHaveBeenCalledWith("Viagem", "video", ["x"]);
    expect(view.result.current.playlists).toHaveLength(3);

    await act(async () => {
      expect(await view.result.current.create("Outra", "video", [])).toBeNull();
    });
    expect(view.result.current.playlists).toHaveLength(3);
    expect(view.result.current.error).toBe("Erro ao criar playlist.");
  });
});
