import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, screen, within } from "@testing-library/react";
import { MovieWatch } from "./MovieWatch";
import { fetchMovieById } from "../../services/movieService";
import { buildMovieCollectionGroups } from "../../utils/movieCollectionGroups";
import type { MovieDetail } from "../../types/movie";
import type { MovieLibraryEntry } from "../../types/movieLibrary";

vi.mock("../../services/movieService", () => ({ fetchMovieById: vi.fn() }));

const fetchMock = vi.mocked(fetchMovieById);

function movie(tmdbId: number, patch: Partial<MovieLibraryEntry> = {}): MovieLibraryEntry {
  return {
    id: `uuid-${tmdbId}`,
    tmdbId,
    title: `Filme ${tmdbId}`,
    posterImage: null,
    status: "watched",
    score: 0,
    releaseDate: `200${tmdbId}-05-01`,
    runtime: 120,
    movieStatus: "RELEASED",
    collectionId: null,
    isCover: false,
    syncedAt: null,
    notes: null,
    watchedAt: null,
    lastAccessAt: null,
    createdAt: "",
    updatedAt: "",
    ...patch,
  };
}

function detail(id: number, patch: Partial<MovieDetail> = {}): MovieDetail {
  return {
    id,
    title: `Filme ${id}`,
    posterImage: "",
    backdropImage: null,
    releaseDate: "2001-05-01",
    voteAverage: 7.5,
    overview: `Sinopse do filme ${id}`,
    movieStatus: "RELEASED",
    runtime: 125,
    genres: ["Drama"],
    tagline: `Frase do filme ${id}`,
    trailerKey: null,
    watchProviders: [],
    voteCount: 100,
    ...patch,
  };
}

// Uma trilogia e um avulso.
const TRILOGY = [
  movie(1, { collectionId: 3, score: 8 }),
  movie(2, { collectionId: 3, score: 7 }),
  movie(3, { collectionId: 3, status: "plan_to_watch" }),
];
const SINGLE = movie(9, { score: 6.5 });
const GROUPS = buildMovieCollectionGroups([...TRILOGY, SINGLE]);

function setup(entry: MovieLibraryEntry = SINGLE, groups = GROUPS) {
  render(
    <MovieWatch
      entry={entry}
      groups={groups}
      autoPlay={false}
      onOpenGroup={vi.fn()}
      onCloseGroup={vi.fn()}
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

describe("MovieWatch", () => {
  it("mostra o título salvo na hora e, quando o detalhe chega, frase, sinopse e ficha", async () => {
    setup();
    expect(screen.getByRole("heading", { name: "Filme 9" })).toBeTruthy();
    expect(await screen.findByText("Sinopse do filme 9")).toBeTruthy();
    expect(screen.getByText("Frase do filme 9")).toBeTruthy();
    expect(screen.getByText("2h 5min")).toBeTruthy();
    const button = screen.getByTitle("Status e nota");
    expect(button.textContent).toContain("Assistido");
    expect(button.textContent).toContain("6.5");
  });

  it("o palco é o trailer quando o filme tem, e uma imagem quando não tem", async () => {
    setup();
    await screen.findByText("Sinopse do filme 9");
    expect(screen.getByTestId("watch-stage")).toBeTruthy();
    cleanup();

    fetchMock.mockImplementation((id: number) => Promise.resolve(detail(id, { trailerKey: "tr1" })));
    setup();
    const player = await screen.findByTitle("Trailer");
    expect(player.getAttribute("src")).toContain("/embed/tr1");
    expect(screen.queryByTestId("watch-stage")).toBeNull();
  });

  it("lista as coleções com a contagem e a média, e o avulso com ano e status", () => {
    setup();
    const panel = within(screen.getByRole("complementary", { name: "Coleções" }));
    const text = panel.getAllByRole("listitem").map((row) => row.textContent);
    // Média só dos avaliados: (8 + 7) / 2.
    expect(text.some((row) => row?.includes("Coleção · 3 filmes") && row.includes("★ 7.5"))).toBe(true);
    expect(text.some((row) => row?.includes("Filme 9") && row.includes("2009 · 2h") && row.includes("Assistido"))).toBe(true);
  });

  it("a linha da coleção soma a duração e mostra o período e o progresso", () => {
    setup();
    const panel = within(screen.getByRole("complementary", { name: "Coleções" }));
    const text = panel.getAllByRole("listitem").map((row) => row.textContent);
    expect(text.some((row) => row?.includes("Coleção · 3 filmes · 2001–2003 · 6h"))).toBe(true);
    expect(text.some((row) => row?.includes("2/3 assistidos"))).toBe(true);
  });

  it("filme que ainda não lançou leva o aviso, e sem duração a linha fica só com o ano", () => {
    const upcoming = movie(9, { movieStatus: "UPCOMING", runtime: null, status: "plan_to_watch", genres: ["Ficção"] });
    setup(upcoming, buildMovieCollectionGroups([upcoming]));
    const row = within(screen.getByRole("complementary", { name: "Coleções" })).getByRole("listitem").textContent;
    expect(row).toContain("2009 · Em breve");
    expect(row).toContain("Ficção");
  });

  it("anda pela coleção do filme aberto", () => {
    setup(TRILOGY[1]);
    expect(screen.getByText(/^\d \/ 3$/)).toBeTruthy();
    expect(screen.getByLabelText("Filme anterior")).toBeTruthy();
    expect(screen.getByLabelText("Próximo filme")).toBeTruthy();
  });
});
