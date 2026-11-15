import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, screen, within } from "@testing-library/react";
import { AnimeWatch } from "./AnimeWatch";
import { fetchAnimeById } from "../../services/animeService";
import { buildFranchiseGroups } from "../../utils/franchiseGroups";
import type { AnimeDetail } from "../../types/anime";
import type { LibraryEntry } from "../../types/library";

vi.mock("../../services/animeService", () => ({ fetchAnimeById: vi.fn() }));

const fetchMock = vi.mocked(fetchAnimeById);

function anime(anilistId: number, patch: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id: `uuid-${anilistId}`,
    anilistId,
    title: `Anime ${anilistId}`,
    coverImage: null,
    status: "watched",
    score: 0,
    totalEpisodes: 12,
    franchiseId: null,
    isCover: false,
    seasonYear: 2010 + anilistId,
    nextAiringEpisode: null,
    endDate: null,
    lastAiredEpisode: null,
    streamingLinks: [],
    syncedAt: null,
    notes: null,
    watchedAt: null,
    lastAccessAt: null,
    createdAt: "",
    updatedAt: "",
    ...patch,
  };
}

function detail(id: number, patch: Partial<AnimeDetail> = {}): AnimeDetail {
  return {
    id,
    title: `Anime ${id}`,
    coverImage: "",
    status: "FINISHED",
    episodes: 12,
    averageScore: 80,
    season: "FALL",
    seasonYear: 2012,
    genres: ["Action"],
    nextAiringEpisode: null,
    streamingLinks: [],
    bannerImage: null,
    description: `Sinopse do anime ${id}`,
    studios: ["Estúdio A"],
    trailer: null,
    externalLinks: [],
    streamingEpisodes: [],
    ...patch,
  };
}

// Uma franquia de dois títulos e um avulso.
const FRANCHISE = [anime(1, { franchiseId: 5, score: 9 }), anime(2, { franchiseId: 5, status: "plan_to_watch" })];
const SINGLE = anime(7);
const GROUPS = buildFranchiseGroups([...FRANCHISE, SINGLE]);

function setup(entry: LibraryEntry = SINGLE, groups = GROUPS) {
  render(
    <AnimeWatch
      entry={entry}
      groups={groups}
      autoPlay={false}
      onToggleGroup={vi.fn()}
      onSelect={vi.fn()}
      onEdit={vi.fn()}
      onNotesChange={vi.fn()}
    />
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((id: number) => Promise.resolve(detail(id)));
});

afterEach(cleanup);

describe("AnimeWatch", () => {
  it("mostra o título salvo na hora e, quando o detalhe chega, estúdio, sinopse e ficha", async () => {
    setup();
    expect(screen.getByRole("heading", { name: "Anime 7" })).toBeTruthy();
    expect(await screen.findByText("Sinopse do anime 7")).toBeTruthy();
    expect(screen.getByText("Estúdio A")).toBeTruthy();
    expect(screen.getByText("Finalizado")).toBeTruthy();
    expect(screen.getByTitle("Status e nota").textContent).toContain("Assistido");
  });

  it("o palco é o trailer quando ele é do YouTube", async () => {
    fetchMock.mockImplementation((id: number) => Promise.resolve(detail(id, { trailer: { id: "yt1", site: "youtube" } })));
    setup();
    const player = await screen.findByTitle("Trailer");
    expect(player.getAttribute("src")).toContain("/embed/yt1");
  });

  // A AniList também devolve trailer de outros sites, que o player não toca.
  it("trailer de outro site não vira player: o palco fica na imagem", async () => {
    fetchMock.mockImplementation((id: number) =>
      Promise.resolve(detail(id, { trailer: { id: "x9", site: "dailymotion" } }))
    );
    setup();
    await screen.findByText("Sinopse do anime 7");
    expect(screen.queryByTitle("Trailer")).toBeNull();
    expect(screen.getByTestId("watch-stage")).toBeTruthy();
  });

  it("lista as franquias como coleção e o avulso com ano e status", () => {
    setup();
    const panel = within(screen.getByRole("complementary", { name: "Franquias" }));
    const text = panel.getAllByRole("listitem").map((row) => row.textContent);
    expect(text.some((row) => row?.includes("Franquia · 2 títulos") && row.includes("★ 9.0"))).toBe(true);
    expect(text.some((row) => row?.includes("Anime 7") && row.includes("2017") && row.includes("Assistido"))).toBe(true);
  });

  it("a linha de um título traz formato, episódios e gêneros, e avisa quando está em exibição", () => {
    const airing = anime(7, { format: "OVA", animeStatus: "RELEASING", genres: ["Ação", "Drama"] });
    setup(airing, buildFranchiseGroups([airing]));
    const row = within(screen.getByRole("complementary", { name: "Franquias" })).getByRole("listitem").textContent;
    expect(row).toContain("2017 · OVA · 12 eps · Em exibição");
    expect(row).toContain("Ação, Drama");
  });

  it("a linha da franquia soma os episódios e mostra o período e o progresso", () => {
    setup();
    const panel = within(screen.getByRole("complementary", { name: "Franquias" }));
    const text = panel.getAllByRole("listitem").map((row) => row.textContent);
    expect(text.some((row) => row?.includes("Franquia · 2 títulos · 2011–2012 · 24 eps"))).toBe(true);
    expect(text.some((row) => row?.includes("1/2 assistidos"))).toBe(true);
  });

  it("anda pela franquia do título aberto", () => {
    setup(FRANCHISE[0]);
    expect(screen.getByText(/^\d \/ 2$/)).toBeTruthy();
    expect(screen.getByLabelText("Título anterior")).toBeTruthy();
    expect(screen.getByLabelText("Próximo título")).toBeTruthy();
  });
});
