import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, fireEvent, cleanup, screen, within } from "@testing-library/react";
import { YoutubeWatch } from "./YoutubeWatch";
import type { YoutubeLibraryEntry, YoutubePlaylist } from "../../types/youtubeLibrary";
import type { ChannelGroup, PlaylistGroup } from "../../utils/youtubeList";

vi.mock("../YoutubePlayer/YoutubePlayer", () => ({
  YoutubePlayer: ({ videoId, onEnded }: { videoId: string; onEnded?: () => void }) => (
    <div data-testid="player" data-video={videoId}>
      <button onClick={onEnded}>fim</button>
    </div>
  ),
}));

beforeEach(() => {
  // jsdom não implementa matchMedia, que o useDismiss consulta ao abrir o menu.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

afterEach(cleanup);

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

const LIST = [track("a"), track("b"), track("c"), track("d")];

// "Treino" guarda a ordem da playlist (c antes de b), diferente da lista.
const PLAYLISTS: PlaylistGroup[] = [
  { id: "pl-1", name: "Treino", tracks: [LIST[2], LIST[1]] },
  { id: "pl-2", name: "Foco", tracks: [] },
];

function handlers() {
  return {
    onKindChange: vi.fn(),
    onToggleChannel: vi.fn(),
    onTogglePlaylist: vi.fn(),
    onRemoveFromPlaylist: vi.fn(),
    onRenamePlaylist: vi.fn(),
    onDeletePlaylist: vi.fn(),
    onShuffleChange: vi.fn(),
    onToggleSelect: vi.fn(),
    onSelectGroup: vi.fn(),
    onSelect: vi.fn(),
    onEdit: vi.fn(),
    onMove: vi.fn(),
    onNotesChange: vi.fn(),
    onAutoplayChange: vi.fn(),
  };
}

type Props = Parameters<typeof YoutubeWatch>[0];

function setup(props: Partial<Props> = {}) {
  const callbacks = handlers();
  render(
    <YoutubeWatch entry={LIST[1]} kind="music" tracks={LIST} playOrder={LIST} autoplay {...callbacks} {...props} />
  );
  return callbacks;
}

function panel() {
  return within(screen.getByRole("complementary"));
}

function inPlaylist(name: string) {
  return within(panel().getByRole("list", { name }));
}

// O texto do título de quem está destacado: item ou cabeçalho de grupo.
function marked(): (string | null)[] {
  return panel()
    .getAllByRole("button")
    .filter((button) => button.getAttribute("aria-current") === "true")
    .map((button) => within(button).getByTitle(/^(Item [a-d]|Treino|Foco|Canal Um)$/).textContent);
}

describe("YoutubeWatch — bloco de playlists", () => {
  it("põe as playlists no topo e mantém a lista embaixo", () => {
    setup({ playlists: PLAYLISTS });
    const rows = panel().getAllByRole("listitem");
    expect(rows).toHaveLength(6);
    expect(within(rows[0]).getByTitle("Treino")).toBeTruthy();
    expect(rows[0].textContent).toContain("2 músicas");
    expect(within(rows[1]).getByTitle("Foco")).toBeTruthy();
    expect(panel().getByRole("separator")).toBeTruthy();
    expect(rows.slice(2).map((row) => within(row).getByTitle(/^Item \w$/).textContent)).toEqual([
      "Item a",
      "Item b",
      "Item c",
      "Item d",
    ]);
  });

  // As playlists repetem itens da lista: o cabeçalho conta só a lista de baixo.
  it("não soma os itens das playlists na contagem do cabeçalho", () => {
    setup({ playlists: PLAYLISTS });
    expect(panel().getByText("4 músicas")).toBeTruthy();
  });

  it("sem o bloco ligado não mostra playlist nem divisor", () => {
    setup();
    expect(panel().queryByTitle("Treino")).toBeNull();
    expect(panel().queryByRole("separator")).toBeNull();
  });

  it("abre e fecha a playlist clicada", () => {
    const { onTogglePlaylist, onSelect } = setup({ playlists: PLAYLISTS });
    const row = panel().getByTitle("Treino").closest("button")!;
    expect(row.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(row);
    expect(onTogglePlaylist).toHaveBeenCalledWith("pl-1");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("aberta, mostra os itens na ordem da playlist", () => {
    setup({ playlists: PLAYLISTS, openPlaylists: new Set(["pl-1"]) });
    const titles = inPlaylist("Treino")
      .getAllByRole("listitem")
      .map((row) => within(row).getByTitle(/^Item \w$/).textContent);
    expect(titles).toEqual(["Item c", "Item b"]);
  });

  it("avisa quando a playlist aberta está vazia", () => {
    setup({ playlists: PLAYLISTS, openPlaylists: new Set(["pl-2"]) });
    expect(panel().getByText("Playlist vazia.")).toBeTruthy();
  });

  it("mostra o aviso recebido quando a aba não tem playlist, e a lista continua", () => {
    setup({ playlists: [], playlistsHint: "Nenhuma playlist ainda." });
    expect(panel().getByText("Nenhuma playlist ainda.")).toBeTruthy();
    expect(panel().getByTitle("Item a")).toBeTruthy();
  });

  // Busca sem resultado na lista de baixo, mas com playlist casando: a playlist
  // tem que continuar na tela.
  it("mantém as playlists quando a lista de baixo está vazia", () => {
    setup({ playlists: PLAYLISTS, tracks: [] });
    expect(panel().getByTitle("Treino")).toBeTruthy();
    expect(panel().getByText("Nenhuma música nesta lista.")).toBeTruthy();
  });
});

describe("YoutubeWatch — tocar de dentro de uma playlist", () => {
  it("escolher um item de dentro avisa de qual playlist ele saiu", () => {
    const { onSelect } = setup({ playlists: PLAYLISTS, openPlaylists: new Set(["pl-1"]) });
    fireEvent.click(inPlaylist("Treino").getByTitle("Item c"));
    expect(onSelect).toHaveBeenCalledWith("c", "pl-1");
  });

  it("escolher na lista de baixo sai sem playlist", () => {
    const { onSelect } = setup({ playlists: PLAYLISTS, openPlaylists: new Set(["pl-1"]) });
    const bottom = panel().getAllByTitle("Item c").find((el) => !el.closest('[aria-label="Treino"]'))!;
    fireEvent.click(bottom);
    expect(onSelect).toHaveBeenCalledWith("c");
  });

  // O item atual (b) aparece na playlist e na lista de baixo: só a linha do
  // contexto que está tocando leva o destaque.
  it("destaca só a linha de dentro da playlist ativa", () => {
    setup({ playlists: PLAYLISTS, openPlaylists: new Set(["pl-1"]), activePlaylistId: "pl-1" });
    expect(marked()).toEqual(["Item b"]);
    const current = panel()
      .getAllByRole("button")
      .find((button) => button.getAttribute("aria-current") === "true")!;
    expect(current.closest('[aria-label="Treino"]')).toBeTruthy();
    expect(screen.getAllByLabelText("Item atual")).toHaveLength(1);
  });

  it("com a playlist ativa fechada, destaca o cabeçalho dela", () => {
    setup({ playlists: PLAYLISTS, activePlaylistId: "pl-1" });
    expect(marked()).toEqual(["Treino"]);
  });

  it("sem playlist ativa o destaque é da lista de baixo, não da playlist que contém o item", () => {
    setup({ playlists: PLAYLISTS, openPlaylists: new Set(["pl-1"]) });
    expect(marked()).toEqual(["Item b"]);
    const current = panel()
      .getAllByRole("button")
      .find((button) => button.getAttribute("aria-current") === "true")!;
    expect(current.closest('[aria-label="Treino"]')).toBeNull();
  });

  // Agrupado por canal e tocando de uma playlist: o canal do item não disputa o destaque.
  it("o canal do item não é destacado enquanto ele toca de uma playlist", () => {
    const channels: ChannelGroup[] = [{ key: "ch-1", name: "Canal Um", thumbnail: null, tracks: [LIST[0], LIST[1]] }];
    setup({ playlists: PLAYLISTS, channels, activePlaylistId: "pl-1" });
    expect(marked()).toEqual(["Treino"]);
  });

  // É isto que mantém a reprodução presa na playlist, em loop.
  it("anterior, próximo e a reprodução automática continuam na playlist", () => {
    const order = [LIST[2], LIST[1]];
    const { onSelect } = setup({ playlists: PLAYLISTS, playOrder: order, activePlaylistId: "pl-1" });
    fireEvent.click(screen.getByLabelText("Próximo item"));
    fireEvent.click(screen.getByLabelText("Item anterior"));
    fireEvent.click(screen.getByText("fim"));
    expect(onSelect.mock.calls).toEqual([
      ["c", "pl-1"],
      ["c", "pl-1"],
      ["c", "pl-1"],
    ]);
  });

  it("dentro da playlist o botão da linha tira o item dela, em vez de mover de aba", () => {
    const { onRemoveFromPlaylist, onMove, onSelect } = setup({
      playlists: PLAYLISTS,
      openPlaylists: new Set(["pl-1"]),
    });
    expect(inPlaylist("Treino").queryByLabelText(/^Mover para/)).toBeNull();
    fireEvent.click(inPlaylist("Treino").getByLabelText("Tirar da playlist: Item c"));
    expect(onRemoveFromPlaylist).toHaveBeenCalledWith("pl-1", LIST[2]);
    expect(onMove).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("YoutubeWatch — ordem aleatória", () => {
  it("só existe tocando de dentro de uma playlist", () => {
    setup({ playlists: PLAYLISTS });
    expect(screen.queryByRole("button", { name: "Ordem aleatória" })).toBeNull();
  });

  it("liga e desliga", () => {
    const { onShuffleChange } = setup({ playlists: PLAYLISTS, activePlaylistId: "pl-1" });
    const toggle = screen.getByRole("button", { name: "Ordem aleatória" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(onShuffleChange).toHaveBeenCalledWith(true);
    cleanup();
    const on = setup({ playlists: PLAYLISTS, activePlaylistId: "pl-1", shuffle: true });
    const pressed = screen.getByRole("button", { name: "Ordem aleatória" });
    expect(pressed.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(pressed);
    expect(on.onShuffleChange).toHaveBeenCalledWith(false);
  });
});

describe("YoutubeWatch — renomear e excluir playlist", () => {
  it("renomeia pela playlist aberta", () => {
    const { onRenamePlaylist } = setup({ playlists: PLAYLISTS, openPlaylists: new Set(["pl-1"]) });
    fireEvent.click(panel().getByRole("button", { name: "Renomear" }));
    const input = panel().getByLabelText("Nome da playlist");
    expect(input).toHaveProperty("value", "Treino");
    fireEvent.change(input, { target: { value: "  Academia " } });
    fireEvent.click(panel().getByRole("button", { name: "Salvar" }));
    expect(onRenamePlaylist).toHaveBeenCalledWith("pl-1", "Academia");
  });

  it("recusa o nome de outra playlist da aba", () => {
    const { onRenamePlaylist } = setup({ playlists: PLAYLISTS, openPlaylists: new Set(["pl-1"]) });
    fireEvent.click(panel().getByRole("button", { name: "Renomear" }));
    fireEvent.change(panel().getByLabelText("Nome da playlist"), { target: { value: "foco" } });
    expect(panel().getByText("Já existe uma playlist com esse nome.")).toBeTruthy();
    expect(panel().getByRole("button", { name: "Salvar" })).toHaveProperty("disabled", true);
    expect(onRenamePlaylist).not.toHaveBeenCalled();
  });

  // Excluir pede confirmação: some com a playlist, não com os vídeos.
  it("só exclui depois de confirmar", () => {
    const { onDeletePlaylist } = setup({ playlists: PLAYLISTS, openPlaylists: new Set(["pl-1"]) });
    fireEvent.click(panel().getByRole("button", { name: "Excluir playlist" }));
    expect(onDeletePlaylist).not.toHaveBeenCalled();
    expect(panel().getByText(/Os itens continuam na biblioteca/)).toBeTruthy();
    fireEvent.click(panel().getByRole("button", { name: "Excluir" }));
    expect(onDeletePlaylist).toHaveBeenCalledWith("pl-1");
  });

  it("cancelar a exclusão não exclui", () => {
    const { onDeletePlaylist } = setup({ playlists: PLAYLISTS, openPlaylists: new Set(["pl-1"]) });
    fireEvent.click(panel().getByRole("button", { name: "Excluir playlist" }));
    fireEvent.click(panel().getByRole("button", { name: "Cancelar" }));
    expect(onDeletePlaylist).not.toHaveBeenCalled();
    expect(panel().getByRole("button", { name: "Excluir playlist" })).toBeTruthy();
  });
});

describe("YoutubeWatch — modo de seleção", () => {
  it("clicar numa linha marca em vez de tocar, e repassa o Shift e a lista da linha", () => {
    const { onToggleSelect, onSelect } = setup({ selection: new Set() });
    fireEvent.click(panel().getByTitle("Item d"), { shiftKey: true });
    expect(onToggleSelect).toHaveBeenCalledWith(LIST[3], true, LIST);
    fireEvent.click(panel().getByTitle("Item a"));
    expect(onToggleSelect).toHaveBeenLastCalledWith(LIST[0], false, LIST);
    expect(onSelect).not.toHaveBeenCalled();
  });

  // Fora do modo de seleção o item atual não responde ao clique; nele, marca.
  it("o item que está tocando também pode ser marcado", () => {
    const { onToggleSelect } = setup({ selection: new Set() });
    fireEvent.click(panel().getByTitle("Item b"));
    expect(onToggleSelect).toHaveBeenCalledWith(LIST[1], false, LIST);
  });

  it("mostra quais linhas estão marcadas", () => {
    setup({ selection: new Set(["uuid-a", "uuid-c"]) });
    const pressed = panel()
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-pressed") === "true")
      .map((button) => within(button).getByTitle(/^Item \w$/).textContent);
    expect(pressed).toEqual(["Item a", "Item c"]);
  });

  it("esconde os botões de mover e de tirar da playlist", () => {
    setup({ selection: new Set(), playlists: PLAYLISTS, openPlaylists: new Set(["pl-1"]) });
    expect(panel().queryByLabelText(/^Mover para/)).toBeNull();
    expect(panel().queryByLabelText(/^Tirar da playlist/)).toBeNull();
    expect(panel().queryByRole("button", { name: "Renomear" })).toBeNull();
  });

  it("dentro de uma playlist, o intervalo do Shift é o da playlist", () => {
    const { onToggleSelect } = setup({
      selection: new Set(),
      playlists: PLAYLISTS,
      openPlaylists: new Set(["pl-1"]),
    });
    fireEvent.click(inPlaylist("Treino").getByTitle("Item c"));
    expect(onToggleSelect).toHaveBeenCalledWith(LIST[2], false, PLAYLISTS[0].tracks);
  });

  it("a caixa do canal marca o canal inteiro, sem abri-lo", () => {
    const channels: ChannelGroup[] = [{ key: "ch-1", name: "Canal Um", thumbnail: null, tracks: [LIST[0], LIST[1]] }];
    const { onSelectGroup, onToggleChannel } = setup({ selection: new Set(["uuid-a"]), channels });
    const box = panel().getByRole("button", { name: "Selecionar tudo: Canal Um" });
    expect(box.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(box);
    expect(onSelectGroup).toHaveBeenCalledWith([LIST[0], LIST[1]]);
    expect(onToggleChannel).not.toHaveBeenCalled();
  });

  it("fora do modo de seleção não há caixa nos grupos, e grupo vazio nunca tem", () => {
    const channels: ChannelGroup[] = [{ key: "ch-1", name: "Canal Um", thumbnail: null, tracks: [LIST[0]] }];
    setup({ channels });
    expect(panel().queryByRole("button", { name: /^Selecionar tudo/ })).toBeNull();
    cleanup();
    setup({ selection: new Set(), playlists: PLAYLISTS });
    expect(panel().getByRole("button", { name: "Selecionar tudo: Treino" })).toBeTruthy();
    expect(panel().queryByRole("button", { name: "Selecionar tudo: Foco" })).toBeNull();
  });

  it("mostra o rodapé recebido abaixo da lista", () => {
    setup({ selection: new Set(), footer: <div>barra de seleção</div> });
    expect(panel().getByText("barra de seleção")).toBeTruthy();
  });
});

describe("YoutubeWatch — playlists do item atual", () => {
  const all: YoutubePlaylist[] = [
    { id: "pl-1", name: "Treino", kind: "music", itemIds: ["uuid-b", "uuid-c"] },
    { id: "pl-2", name: "Foco", kind: "music", itemIds: [] },
  ];

  function itemPlaylists(patch: Partial<NonNullable<Props["itemPlaylists"]>> = {}) {
    return { playlists: all, onAdd: vi.fn(), onRemove: vi.fn(), onCreate: vi.fn(), ...patch };
  }

  it("o botão diz em quantas playlists o item está", () => {
    setup({ itemPlaylists: itemPlaylists() });
    expect(screen.getByRole("button", { name: "Playlists · 1" })).toBeTruthy();
    cleanup();
    setup({ entry: LIST[0], itemPlaylists: itemPlaylists() });
    expect(screen.getByRole("button", { name: "Playlists" })).toBeTruthy();
  });

  it("põe e tira o item atual das playlists pelo menu, que fica aberto", () => {
    const config = itemPlaylists();
    setup({ itemPlaylists: config });
    fireEvent.click(screen.getByRole("button", { name: "Playlists · 1" }));
    const menu = within(screen.getByRole("dialog", { name: "Playlists" }));
    expect(menu.getByRole("button", { name: "Treino" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(menu.getByRole("button", { name: "Foco" }));
    expect(config.onAdd).toHaveBeenCalledWith("pl-2");
    fireEvent.click(menu.getByRole("button", { name: "Treino" }));
    expect(config.onRemove).toHaveBeenCalledWith("pl-1");
    expect(screen.getByRole("dialog", { name: "Playlists" })).toBeTruthy();
  });

  it("fica desabilitado sem conexão", () => {
    setup({ itemPlaylists: itemPlaylists({ disabled: true }) });
    expect(screen.getByRole("button", { name: "Playlists · 1" })).toHaveProperty("disabled", true);
  });
});
