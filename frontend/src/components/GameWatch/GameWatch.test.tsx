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

  it("sem trailer o palco é uma imagem, não um player", async () => {
    setup();
    await screen.findByText("Descrição do jogo 9");
    expect(screen.getByTestId("game-stage")).toBeTruthy();
    expect(screen.queryByTitle("Trailer")).toBeNull();
  });

  it("com trailer o palco é o player, pausado até alguém escolher um jogo", async () => {
    fetchMock.mockImplementation((id: number) => Promise.resolve(detail(id, { trailer: { youtubeId: "abc" } })));
    const { view } = setup();
    const player = await screen.findByTitle("Trailer");
    expect(player.getAttribute("src")).toContain("/embed/abc");
    expect(player.getAttribute("src")).not.toContain("autoplay=1");
    expect(screen.queryByTestId("game-stage")).toBeNull();

    view.rerender(element({ autoPlay: true }));
    expect(screen.getByTitle("Trailer").getAttribute("src")).toContain("autoplay=1");
  });

  // A anotação é o único dado da tela que é do usuário: não some com o detalhe.
  it("quando o detalhe falha avisa e mantém a anotação", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    setup({ entry: game(9, { notes: "minha nota" }) });
    expect(await screen.findByText(/Não deu para carregar os detalhes/)).toBeTruthy();
    expect(screen.getByRole("textbox")).toHaveProperty("value", "minha nota");
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
    expect(single.textContent).toContain("2009 · Zerado");
    expect(single.textContent).toContain("★ 9.5");
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
    expect(onSelect).toHaveBeenCalledWith(9);
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
    expect(onSelect).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByRole("button", { name: "← Todas as coleções" }));
    expect(onCloseGroup).toHaveBeenCalledTimes(1);
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
    expect(onSelect.mock.calls).toEqual([[last.igdbId], [first.igdbId]]);
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
    expect(onSelect.mock.calls).toEqual([[last.igdbId], [first.igdbId]]);

    fireEvent.keyDown(screen.getByRole("textbox"), { key: "ArrowRight" });
    expect(onSelect).toHaveBeenCalledTimes(2);

    view.rerender(element({ entry: middle, navKeys: false, onSelect }));
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });
});
