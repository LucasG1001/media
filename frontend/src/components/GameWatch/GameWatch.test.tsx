import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, fireEvent, cleanup, screen, within, waitFor } from "@testing-library/react";
import { GameWatch } from "./GameWatch";
import { fetchGameById } from "../../services/gameService";
import { buildGameCollectionGroups } from "../../utils/gameCollectionGroups";
import type { GameDetail } from "../../types/game";
import type { GameLibraryEntry } from "../../types/gameLibrary";

vi.mock("../../services/gameService", () => ({ fetchGameById: vi.fn() }));

const fetchMock = vi.mocked(fetchGameById);

function game(igdbId: number, patch: Partial<GameLibraryEntry> = {}): GameLibraryEntry {
  return {
    id: `uuid-${igdbId}`,
    igdbId,
    title: `Jogo ${igdbId}`,
    backgroundImage: null,
    status: "beaten",
    score: 0,
    released: `20${String(igdbId).padStart(2, "0")}-01-01`,
    metacritic: null,
    gameStatus: "RELEASED",
    collectionId: null,
    isCover: false,
    gameModes: null,
    syncedAt: null,
    notes: null,
    finishedAt: null,
    lastAccessAt: null,
    createdAt: "",
    updatedAt: "",
    ...patch,
  };
}

function detail(igdbId: number, patch: Partial<GameDetail> = {}): GameDetail {
  return {
    id: igdbId,
    title: `Jogo ${igdbId}`,
    backgroundImage: null,
    released: "2020-01-01",
    rating: null,
    metacritic: null,
    gameStatus: "RELEASED",
    storeSlugs: [],
    summary: null,
    description: `Descrição do jogo ${igdbId}`,
    website: null,
    developers: ["Estúdio"],
    publishers: [],
    platforms: [],
    genres: [],
    esrb: null,
    stores: [],
    trailer: null,
    bannerImage: null,
    screenshots: [],
    ratingsCount: null,
    steamAppId: null,
    ...patch,
  };
}

// Uma saga de três (ids 1–3, com notas 8 e 6) e um avulso (id 9).
const SAGA = [
  game(1, { collectionId: 7, score: 8 }),
  game(2, { collectionId: 7, score: 6, status: "plan_to_play" }),
  game(3, { collectionId: 7 }),
];
const SINGLE = game(9, { score: 9.5 });
const GROUPS = buildGameCollectionGroups([...SAGA, SINGLE]);
const SAGA_GROUP = GROUPS.find((group) => group.key === "collection-7")!;

type Props = Parameters<typeof GameWatch>[0];

function handlers() {
  return {
    onOpenGroup: vi.fn(),
    onCloseGroup: vi.fn(),
    onSelect: vi.fn(),
    onEdit: vi.fn(),
    onGameLoad: vi.fn(),
    onNotesChange: vi.fn(),
  };
}

function element(props: Partial<Props> = {}, callbacks = handlers()) {
  return <GameWatch entry={SINGLE} groups={GROUPS} autoPlay={false} {...callbacks} {...props} />;
}

function setup(props: Partial<Props> = {}) {
  const callbacks = handlers();
  const view = render(element(props, callbacks));
  return { ...callbacks, view };
}

function panel() {
  return within(screen.getByRole("complementary"));
}

function currentRows(): (string | null)[] {
  return panel()
    .getAllByRole("button")
    .filter((button) => button.getAttribute("aria-current") === "true")
    .map((button) => within(button).getByTitle(/^Jogo \d$/).textContent);
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((id: number) => Promise.resolve(detail(id)));
});

afterEach(cleanup);

describe("GameWatch — palco", () => {
  it("mostra o título salvo na hora e o detalhe quando chega", async () => {
    const { onGameLoad } = setup();
    expect(screen.getByRole("heading", { name: "Jogo 9" })).toBeTruthy();
    expect(screen.getByText("Carregando detalhes...")).toBeTruthy();
    expect(await screen.findByText("Descrição do jogo 9")).toBeTruthy();
    expect(screen.getByText("Estúdio")).toBeTruthy();
    expect(onGameLoad).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }));
  });

  // A capa aqui piscaria antes de o vídeo entrar: só se sabe se há trailer
  // quando o detalhe chega.
  it("enquanto o detalhe carrega o palco fica vazio, sem a capa", async () => {
    setup();
    expect(screen.getByTestId("watch-stage-loading")).toBeTruthy();
    expect(screen.queryByTestId("watch-stage")).toBeNull();

    await screen.findByText("Descrição do jogo 9");
    expect(screen.queryByTestId("watch-stage-loading")).toBeNull();
    expect(screen.getByTestId("watch-stage")).toBeTruthy();
  });

  it("com trailer o vídeo entra direto, sem imagem antes", async () => {
    let deliver: (game: GameDetail) => void = () => {};
    fetchMock.mockImplementation(() => new Promise<GameDetail>((resolve) => { deliver = resolve; }));
    setup();
    expect(screen.queryByTestId("watch-stage")).toBeNull();
    expect(screen.queryByTitle("Trailer")).toBeNull();

    deliver(detail(9, { trailer: { youtubeId: "abc" } }));
    expect(await screen.findByTitle("Trailer")).toBeTruthy();
    expect(screen.queryByTestId("watch-stage")).toBeNull();
    expect(screen.queryByTestId("watch-stage-loading")).toBeNull();
  });

  it("sem trailer o palco é uma imagem, não um player", async () => {
    setup();
    await screen.findByText("Descrição do jogo 9");
    expect(screen.getByTestId("watch-stage")).toBeTruthy();
    expect(screen.queryByTitle("Trailer")).toBeNull();
  });

  it("com trailer o palco é o player, pausado até alguém escolher um jogo", async () => {
    fetchMock.mockImplementation((id: number) => Promise.resolve(detail(id, { trailer: { youtubeId: "abc" } })));
    const { view } = setup();
    const player = await screen.findByTitle("Trailer");
    expect(player.getAttribute("src")).toContain("/embed/abc");
    expect(player.getAttribute("src")).not.toContain("autoplay=1");
    expect(screen.queryByTestId("watch-stage")).toBeNull();

    view.rerender(element({ autoPlay: true }));
    expect(screen.getByTitle("Trailer").getAttribute("src")).toContain("autoplay=1");
  });

  // A anotação é o único dado da tela que é do usuário: não some com o detalhe.
  it("quando o detalhe falha avisa e mantém a anotação", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    setup({ entry: game(9, { notes: "minha nota" }) });
    expect(await screen.findByText(/Não deu para carregar os detalhes/)).toBeTruthy();
    expect(screen.getByRole("textbox")).toHaveProperty("value", "minha nota");
    // Sem detalhe não há trailer nem imagem de fundo: o palco cai na capa.
    expect(screen.getByTestId("watch-stage")).toBeTruthy();
  });

  it("troca a anotação ao mudar de jogo, sem remontar a tela", async () => {
    const { view } = setup({ entry: game(1, { collectionId: 7, notes: "nota do 1" }) });
    expect(screen.getByRole("textbox")).toHaveProperty("value", "nota do 1");
    view.rerender(element({ entry: game(2, { collectionId: 7, notes: "nota do 2" }) }));
    expect(screen.getByRole("textbox")).toHaveProperty("value", "nota do 2");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(2));
  });

  it("abre o modal de status e nota pelo botão abaixo do palco", () => {
    const { onEdit } = setup();
    const button = screen.getByTitle("Status e nota");
    expect(button.textContent).toContain("Zerado");
    expect(button.textContent).toContain("9.5");
    fireEvent.click(button);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

describe("GameWatch — lista de coleções", () => {
  it("lista as coleções na ordem recebida: a de vários jogos como coleção, o avulso como jogo", () => {
    setup();
    const rows = panel().getAllByRole("listitem");
    expect(rows).toHaveLength(GROUPS.length);
    const saga = rows[GROUPS.indexOf(SAGA_GROUP)];
    expect(saga.textContent).toContain("Coleção · 3 jogos");
    // Média só dos avaliados: (8 + 6) / 2.
    expect(saga.textContent).toContain("★ 7.0");
    const single = rows[GROUPS.findIndex((group) => group.key === "single-9")];
    expect(single.textContent).toContain("2009");
    expect(single.textContent).toContain("Zerado");
    expect(single.textContent).toContain("★ 9.5");
  });

  it("a linha de um jogo traz ano, Metacritic, modos, gêneros e último acesso", () => {
    const rich = game(9, {
      metacritic: 92,
      gameModes: ["singleplayer", "coop", "mmo"],
      genres: ["RPG", "Ação", "Aventura", "Puzzle"],
      lastAccessAt: new Date().toISOString(),
    });
    setup({ entry: rich, groups: buildGameCollectionGroups([rich]) });
    const row = panel().getByRole("listitem").textContent;
    // Só os dois primeiros modos e os três primeiros gêneros cabem.
    expect(row).toContain("2009 · Metacritic 92 · Um jogador, Cooperativo");
    expect(row).not.toContain("MMO");
    expect(row).toContain("RPG, Ação, Aventura");
    expect(row).not.toContain("Puzzle");
    expect(row).toContain("jogado hoje");
  });

  it("jogo sem os dados extras fica só com ano, status e nota", () => {
    setup();
    const single = panel().getAllByRole("listitem")[GROUPS.findIndex((group) => group.key === "single-9")];
    expect(single.textContent).not.toContain("Metacritic");
    expect(single.textContent).not.toContain("jogado");
    expect(single.textContent).not.toContain("Em breve");
  });

  it("jogo que ainda não lançou leva o aviso", () => {
    const upcoming = game(9, { gameStatus: "UPCOMING", status: "plan_to_play" });
    setup({ entry: upcoming, groups: buildGameCollectionGroups([upcoming]) });
    expect(panel().getByRole("listitem").textContent).toContain("2009 · Em breve");
  });

  it("o status de cada linha leva o tom do papel dele", () => {
    setup({ entry: SAGA[0], openGroup: SAGA_GROUP });
    const tones = SAGA_GROUP.members.map((member) => {
      const row = panel().getByTitle(member.title).closest("li")!;
      return row.querySelector("[data-tone]")?.getAttribute("data-tone");
    });
    expect(tones).toEqual(SAGA_GROUP.members.map((member) => (member.status === "beaten" ? "done" : "plan")));
  });

  it("a linha da coleção traz o período, os gêneros mais comuns e o progresso", () => {
    const saga = [
      game(1, { collectionId: 7, genres: ["RPG", "Ação"], lastAccessAt: "2020-01-01T00:00:00Z" }),
      game(2, { collectionId: 7, genres: ["RPG"], status: "plan_to_play" }),
      game(3, { collectionId: 7, genres: ["Ação", "RPG", "Terror"], status: "replaying" }),
    ];
    setup({ entry: saga[0], groups: buildGameCollectionGroups(saga) });
    const row = panel().getByRole("listitem").textContent;
    expect(row).toContain("Coleção · 3 jogos · 2001–2003");
    expect(row).toContain("RPG, Ação, Terror");
    // A revisita conta como concluído.
    expect(row).toContain("2/3 zerados");
    expect(row).toContain("jogado há");
  });

  it("com filtro mostra quantos jogos da coleção batem", () => {
    const filtered = buildGameCollectionGroups(SAGA, (entry) => entry.status === "plan_to_play");
    setup({ entry: SAGA[0], groups: filtered });
    expect(panel().getAllByRole("listitem")[0].textContent).toContain("Coleção · 1/3 jogos");
  });

  it("clicar numa coleção a abre, sem trocar o jogo do palco", () => {
    const { onOpenGroup, onSelect } = setup();
    fireEvent.click(panel().getByTitle(SAGA_GROUP.representative.title));
    expect(onOpenGroup).toHaveBeenCalledWith("collection-7");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("clicar num jogo avulso o abre direto no palco", () => {
    const { onSelect, onOpenGroup } = setup({ entry: SAGA[0] });
    fireEvent.click(panel().getByTitle("Jogo 9"));
    expect(onSelect).toHaveBeenCalledWith(SINGLE);
    expect(onOpenGroup).not.toHaveBeenCalled();
  });

  it("clicar no jogo que já está no palco não faz nada", () => {
    const { onSelect } = setup();
    fireEvent.click(panel().getByTitle("Jogo 9"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("destaca o jogo aberto, ou a coleção em que ele está", () => {
    const { view } = setup();
    expect(currentRows()).toEqual(["Jogo 9"]);
    view.rerender(element({ entry: SAGA[1] }));
    expect(currentRows()).toEqual([SAGA_GROUP.representative.title]);
  });

  it("com uma coleção aberta mostra todos os jogos dela e o botão de saída", () => {
    const { onCloseGroup, onSelect } = setup({ entry: SAGA[1], openGroup: SAGA_GROUP });
    const titles = panel()
      .getAllByRole("listitem")
      .map((row) => within(row).getByTitle(/^Jogo \d$/).textContent);
    expect(titles).toEqual(SAGA_GROUP.members.map((member) => member.title));
    expect(currentRows()).toEqual(["Jogo 2"]);
    expect(panel().getByText("3 jogos")).toBeTruthy();

    fireEvent.click(panel().getByTitle("Jogo 3"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ igdbId: 3 }));
    fireEvent.click(screen.getByRole("button", { name: "← Todas as coleções" }));
    expect(onCloseGroup).toHaveBeenCalledTimes(1);
  });

  it("mostra os controles da página dentro do painel, acima da lista", () => {
    setup({ controls: <input aria-label="Buscar na biblioteca" /> });
    const search = panel().getByLabelText("Buscar na biblioteca");
    const list = panel().getByRole("list");
    expect(search.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // Filtro sem resultado: a página manda a lista vazia e o item que já estava
  // no palco.
  it("sem coleção para listar avisa que não há resultado e mantém o palco", () => {
    setup({ groups: [], controls: <input aria-label="Buscar na biblioteca" /> });
    expect(panel().getByText("Nenhum resultado.")).toBeTruthy();
    expect(panel().getByLabelText("Buscar na biblioteca")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Jogo 9" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Próximo jogo" })).toBeNull();
  });

  it("com coleções na lista não há aviso de vazio", () => {
    setup();
    expect(panel().queryByText("Nenhum resultado.")).toBeNull();
  });

  it("sem coleção aberta não mostra o botão de saída", () => {
    setup();
    expect(screen.queryByRole("button", { name: "← Todas as coleções" })).toBeNull();
  });
});

describe("GameWatch — anterior e próximo", () => {
  // A ordem é a dos membros da coleção, como está na tela.
  const [first, middle, last] = SAGA_GROUP.members;

  it("anda pela coleção do jogo aberto e mostra a posição", () => {
    const { onSelect } = setup({ entry: middle });
    expect(screen.getByText("2 / 3")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Próximo jogo"));
    fireEvent.click(screen.getByLabelText("Jogo anterior"));
    expect(onSelect.mock.calls).toEqual([[last], [first]]);
  });

  it("desabilita o botão na ponta da coleção", () => {
    setup({ entry: first });
    expect(screen.getByLabelText("Jogo anterior")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Próximo jogo")).toHaveProperty("disabled", false);
  });

  it("jogo avulso não tem anterior nem próximo", () => {
    setup();
    expect(screen.queryByLabelText("Próximo jogo")).toBeNull();
    expect(screen.queryByLabelText("Jogo anterior")).toBeNull();
  });

  it("as setas do teclado navegam, menos digitando ou com as teclas desligadas", () => {
    const { onSelect, view } = setup({ entry: middle });
    fireEvent.keyDown(document, { key: "ArrowRight" });
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(onSelect.mock.calls).toEqual([[last], [first]]);

    fireEvent.keyDown(screen.getByRole("textbox"), { key: "ArrowRight" });
    expect(onSelect).toHaveBeenCalledTimes(2);

    view.rerender(element({ entry: middle, navKeys: false, onSelect }));
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });
});
