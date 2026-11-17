import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, fireEvent, cleanup, screen, within, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { YouTubePage } from "./YouTubePage";
import { useYoutubeLibrary } from "../../hooks/useYoutubeLibrary";
import { useYoutubePlaylists } from "../../hooks/useYoutubePlaylists";
import type { YoutubeLibraryEntry, YoutubePlaylist } from "../../types/youtubeLibrary";

vi.mock("../../hooks/useYoutubeLibrary");
vi.mock("../../hooks/useYoutubePlaylists");
// O player de verdade depende da IFrame API do YouTube.
vi.mock("../../components/YoutubePlayer/YoutubePlayer", () => ({
  YoutubePlayer: ({ videoId }: { videoId: string }) => <div data-testid="player" data-video={videoId} />,
}));

function track(videoId: string, patch: Partial<YoutubeLibraryEntry> = {}): YoutubeLibraryEntry {
  return {
    id: `uuid-${videoId}`,
    videoId,
    title: `Item ${videoId}`,
    channelId: `ch-${videoId}`,
    channelTitle: `Canal ${videoId}`,
    channelThumbnail: null,
    thumbnail: null,
    durationSeconds: 185,
    viewCount: 1500,
    publishedAt: null,
    description: null,
    kind: "music",
    status: "liked",
    score: 0,
    notes: null,
    lastAccessAt: null,
    ...patch,
  } as YoutubeLibraryEntry;
}

// Em ordem alfabética a lista é a, b, c, d; "v" é da aba de vídeos.
const ENTRIES = [track("a"), track("b"), track("c"), track("d"), track("v", { kind: "video" })];

// A ordem da playlist (d antes de b) é diferente da ordem da lista.
const TREINO: YoutubePlaylist = { id: "pl-1", name: "Treino", kind: "music", itemIds: ["uuid-d", "uuid-b"] };

function mockLibrary() {
  const library = {
    entries: ENTRIES,
    loading: false,
    error: null,
    update: vi.fn(),
    remove: vi.fn(),
    findByVideoId: (videoId: string) => ENTRIES.find((entry) => entry.videoId === videoId),
    registerAccess: vi.fn(),
    addFromUrl: vi.fn(),
  };
  vi.mocked(useYoutubeLibrary).mockReturnValue(library as unknown as ReturnType<typeof useYoutubeLibrary>);
  return library;
}

function mockPlaylists(playlists: YoutubePlaylist[] = [TREINO]) {
  const api = {
    playlists,
    error: null,
    create: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    addItems: vi.fn().mockResolvedValue(true),
    removeItems: vi.fn().mockResolvedValue(true),
  };
  vi.mocked(useYoutubePlaylists).mockReturnValue(api);
  return api;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/youtube/:videoId?" element={<YouTubePage />} />
      </Routes>
    </MemoryRouter>
  );
}

function panel() {
  return within(screen.getByRole("complementary"));
}

function playing(): string | null {
  return screen.getByTestId("player").getAttribute("data-video");
}

beforeEach(() => {
  localStorage.clear();
  // jsdom não implementa matchMedia (useIsMobile do TopbarSlot, useDismiss dos menus).
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("YouTubePage — tocar de dentro de uma playlist", () => {
  // Na lista, depois do "b" vem o "c". Na playlist (d, b), depois do "b" volta o "d".
  it("com ?list= o próximo sai da playlist, em loop, e não da lista", () => {
    localStorage.setItem("youtube-show-playlists", "true");
    mockLibrary();
    mockPlaylists();
    renderAt("/youtube/b?list=pl-1");
    fireEvent.click(screen.getByLabelText("Próximo item"));
    expect(playing()).toBe("d");
    fireEvent.click(screen.getByLabelText("Próximo item"));
    expect(playing()).toBe("b");
  });

  it("abrir a página já com ?list= mostra a playlist aberta", () => {
    localStorage.setItem("youtube-show-playlists", "true");
    mockLibrary();
    mockPlaylists();
    renderAt("/youtube/b?list=pl-1");
    expect(panel().getByRole("list", { name: "Treino" })).toBeTruthy();
  });

  it("sem ?list= a reprodução segue a lista de baixo", () => {
    localStorage.setItem("youtube-show-playlists", "true");
    mockLibrary();
    mockPlaylists();
    renderAt("/youtube/b");
    fireEvent.click(screen.getByLabelText("Próximo item"));
    expect(playing()).toBe("c");
  });

  // O contexto só vale com a playlist na tela.
  it("com o bloco de playlists desligado o ?list= é ignorado", () => {
    mockLibrary();
    mockPlaylists();
    renderAt("/youtube/b?list=pl-1");
    expect(panel().queryByTitle("Treino")).toBeNull();
    expect(screen.queryByRole("button", { name: "Ordem aleatória" })).toBeNull();
    fireEvent.click(screen.getByLabelText("Próximo item"));
    expect(playing()).toBe("c");
  });

  it("escolher um item de dentro da playlist entra nela; escolher na lista de baixo sai", () => {
    localStorage.setItem("youtube-show-playlists", "true");
    mockLibrary();
    mockPlaylists();
    renderAt("/youtube/a");
    fireEvent.click(panel().getByTitle("Treino"));
    fireEvent.click(within(panel().getByRole("list", { name: "Treino" })).getByTitle("Item b"));
    expect(playing()).toBe("b");
    expect(screen.getByRole("button", { name: "Ordem aleatória" })).toBeTruthy();

    const bottom = panel().getAllByTitle("Item c").find((el) => !el.closest('[aria-label="Treino"]'))!;
    fireEvent.click(bottom);
    expect(playing()).toBe("c");
    expect(screen.queryByRole("button", { name: "Ordem aleatória" })).toBeNull();
  });

  it("guarda a ordem aleatória e o bloco de playlists entre visitas", () => {
    localStorage.setItem("youtube-show-playlists", "true");
    mockLibrary();
    mockPlaylists();
    renderAt("/youtube/b?list=pl-1");
    fireEvent.click(screen.getByRole("button", { name: "Ordem aleatória" }));
    expect(localStorage.getItem("youtube-shuffle")).toBe("true");
    fireEvent.click(panel().getByRole("button", { name: "Mostrar playlists" }));
    expect(localStorage.getItem("youtube-show-playlists")).toBe("false");
  });
});

describe("YouTubePage — seleção em lote", () => {
  it("adiciona os marcados à playlist escolhida, na ordem em que foram marcados, e sai do modo", async () => {
    mockLibrary();
    const playlists = mockPlaylists();
    renderAt("/youtube/a");
    fireEvent.click(panel().getByRole("button", { name: "Selecionar vários" }));
    fireEvent.click(panel().getByTitle("Item c"));
    fireEvent.click(panel().getByTitle("Item a"));
    expect(screen.getByText("2 selecionados")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar à playlist" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Treino" }));
    expect(playlists.addItems).toHaveBeenCalledWith("pl-1", ["uuid-c", "uuid-a"]);

    await waitFor(() => expect(screen.queryByRole("toolbar")).toBeNull());
    expect(screen.getByText('Playlist "Treino": 2 itens da seleção.')).toBeTruthy();
    // A playlist que recebeu os itens aparece: o bloco liga sozinho.
    expect(panel().getByTitle("Treino")).toBeTruthy();
  });

  it("cria uma playlist nova da aba ativa com os marcados", async () => {
    mockLibrary();
    const playlists = mockPlaylists([]);
    playlists.create.mockResolvedValue({ id: "pl-9", name: "Estrada", kind: "music", itemIds: ["uuid-b"] });
    renderAt("/youtube/a");
    fireEvent.click(panel().getByRole("button", { name: "Selecionar vários" }));
    fireEvent.click(panel().getByTitle("Item b"));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar à playlist" }));
    const menu = within(screen.getByRole("dialog"));
    fireEvent.change(menu.getByLabelText("Nome da nova playlist"), { target: { value: "Estrada" } });
    fireEvent.click(menu.getByRole("button", { name: "Criar" }));
    expect(playlists.create).toHaveBeenCalledWith("Estrada", "music", ["uuid-b"]);
    await waitFor(() => expect(screen.queryByRole("toolbar")).toBeNull());
  });

  it("Shift+clique marca o intervalo e 'todos' marca a lista inteira", () => {
    mockLibrary();
    mockPlaylists();
    renderAt("/youtube/a");
    fireEvent.click(panel().getByRole("button", { name: "Selecionar vários" }));
    fireEvent.click(panel().getByTitle("Item a"));
    fireEvent.click(panel().getByTitle("Item c"), { shiftKey: true });
    expect(screen.getByText("3 selecionados")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Selecionar todos" }));
    expect(screen.getByText("4 selecionados")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Desmarcar todos" }));
    expect(screen.getByText("Marque os itens")).toBeTruthy();
  });

  // A seleção é de uma aba só: playlist não mistura música e vídeo.
  it("trocar de aba esvazia a seleção", () => {
    mockLibrary();
    mockPlaylists();
    renderAt("/youtube/a");
    fireEvent.click(panel().getByRole("button", { name: "Selecionar vários" }));
    fireEvent.click(panel().getByTitle("Item b"));
    fireEvent.click(panel().getByRole("button", { name: "Vídeos" }));
    expect(screen.getByText("Marque os itens")).toBeTruthy();
  });

  it("marcar não troca o item que está tocando", () => {
    mockLibrary();
    mockPlaylists();
    renderAt("/youtube/a");
    fireEvent.click(panel().getByRole("button", { name: "Selecionar vários" }));
    fireEvent.click(panel().getByTitle("Item c"));
    expect(playing()).toBe("a");
  });
});

describe("YouTubePage — playlist do YouTube colada", () => {
  async function pasteLink() {
    fireEvent.change(screen.getByPlaceholderText(/Cole o link/), { target: { value: "https://youtube.com/playlist?list=X" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    return screen.findByRole("button", { name: /playlist “Mix”/ });
  }

  // `videoIds` vem na ordem da playlist do YouTube e inclui o que já estava na
  // biblioteca. O "v" é vídeo e o link foi colado em Músicas: fica de fora.
  it("oferece criar a playlist com os itens da aba, na ordem do YouTube", async () => {
    const library = mockLibrary();
    const playlists = mockPlaylists([]);
    library.addFromUrl.mockResolvedValue({ playlist: { name: "Mix", imported: 1, total: 3, videoIds: ["c", "v", "a"] } });
    playlists.create.mockResolvedValue({ id: "pl-9", name: "Mix", kind: "music", itemIds: ["uuid-c", "uuid-a"] });
    renderAt("/youtube/a");

    const offer = await pasteLink();
    expect(offer.textContent).toBe("Criar playlist “Mix”");
    expect(playlists.create).not.toHaveBeenCalled();
    fireEvent.click(offer);
    expect(playlists.create).toHaveBeenCalledWith("Mix", "music", ["uuid-c", "uuid-a"]);
    expect(await screen.findByText('Playlist "Mix" criada com 2 itens.')).toBeTruthy();
    expect(screen.queryByRole("button", { name: /playlist “Mix”/ })).toBeNull();
  });

  it("com uma playlist de mesmo nome na aba, oferece adicionar a ela", async () => {
    const library = mockLibrary();
    const playlists = mockPlaylists([{ id: "pl-7", name: "mix", kind: "music", itemIds: [] }]);
    library.addFromUrl.mockResolvedValue({ playlist: { name: "Mix", imported: 0, total: 2, videoIds: ["b", "d"] } });
    renderAt("/youtube/a");

    const offer = await pasteLink();
    expect(offer.textContent).toBe("Adicionar à playlist “Mix”");
    fireEvent.click(offer);
    expect(playlists.addItems).toHaveBeenCalledWith("pl-7", ["uuid-b", "uuid-d"]);
    expect(playlists.create).not.toHaveBeenCalled();
    expect(await screen.findByText('Playlist "Mix" atualizada com 2 itens.')).toBeTruthy();
  });

  // Mesmo nome em outra aba não conta: o nome é único por aba.
  it("playlist de mesmo nome na outra aba não impede criar", async () => {
    const library = mockLibrary();
    const playlists = mockPlaylists([{ id: "pl-7", name: "Mix", kind: "video", itemIds: [] }]);
    library.addFromUrl.mockResolvedValue({ playlist: { name: "Mix", imported: 0, total: 1, videoIds: ["b"] } });
    playlists.create.mockResolvedValue(null);
    renderAt("/youtube/a");

    const offer = await pasteLink();
    expect(offer.textContent).toBe("Criar playlist “Mix”");
    fireEvent.click(offer);
    expect(playlists.create).toHaveBeenCalledWith("Mix", "music", ["uuid-b"]);
    // Criação recusada: a oferta continua lá para tentar de novo.
    await waitFor(() => expect(playlists.create).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: /playlist “Mix”/ })).toBeTruthy();
  });

  it("vídeo único colado não oferece playlist", async () => {
    const library = mockLibrary();
    mockPlaylists([]);
    library.addFromUrl.mockResolvedValue(track("z", { title: "Novo" }));
    renderAt("/youtube/a");
    fireEvent.change(screen.getByPlaceholderText(/Cole o link/), { target: { value: "https://youtu.be/z" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(await screen.findByText(/"Novo": música adicionada em Músicas\./)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Criar playlist/ })).toBeNull();
  });
});
