import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, screen, within, waitFor } from "@testing-library/react";
import { SeriesWatch } from "./SeriesWatch";
import { fetchSeasonById, fetchSeriesById } from "../../services/seriesService";
import { buildSeasonGroups, type SeasonGroup, type SeasonMember } from "../../utils/seasonGroups";
import type { SeasonDetail, SeriesDetail } from "../../types/series";
import type { SeriesLibraryEntry } from "../../types/seriesLibrary";

vi.mock("../../services/seriesService", () => ({ fetchSeriesById: vi.fn(), fetchSeasonById: vi.fn() }));

const seriesMock = vi.mocked(fetchSeriesById);
const seasonMock = vi.mocked(fetchSeasonById);

function series(tmdbId: number, patch: Partial<SeriesLibraryEntry> = {}): SeriesLibraryEntry {
  return {
    id: `uuid-${tmdbId}`,
    tmdbId,
    title: `Série ${tmdbId}`,
    posterImage: null,
    status: "watched",
    score: 0,
    firstAirDate: "2015-01-01",
    seasons: null,
    episodes: null,
    seriesStatus: "RELEASED",
    airStatus: "Ended",
    nextAiringEpisode: null,
    lastAiredEpisode: null,
    syncedAt: null,
    seasonList: null,
    seasonStates: null,
    coverSeason: null,
    watchedAt: null,
    lastAccessAt: null,
    createdAt: "",
    updatedAt: "",
    ...patch,
  };
}

function seasonMeta(number: number) {
  return { number, name: `Temporada ${number}`, poster: null, episodeCount: 8, airDate: `201${number}-03-01` };
}

function seriesDetail(id: number, patch: Partial<SeriesDetail> = {}): SeriesDetail {
  return {
    id,
    title: `Série ${id}`,
    posterImage: "",
    backdropImage: null,
    firstAirDate: "2015-01-01",
    voteAverage: 8.2,
    overview: `Sinopse da série ${id}`,
    seriesStatus: "RELEASED",
    seasons: 2,
    episodes: 16,
    genres: ["Drama"],
    tagline: `Frase da série ${id}`,
    airStatus: "Ended",
    trailerKey: null,
    watchProviders: [],
    voteCount: 50,
    ...patch,
  };
}

function seasonDetail(seasonNumber: number, patch: Partial<SeasonDetail> = {}): SeasonDetail {
  return {
    seasonNumber,
    name: `Temporada ${seasonNumber}`,
    overview: `Sinopse da temporada ${seasonNumber}`,
    poster: null,
    airDate: null,
    episodeCount: 1,
    episodes: [
      {
        episodeNumber: 1,
        name: `Piloto da temporada ${seasonNumber}`,
        overview: null,
        airDate: null,
        runtime: 50,
        still: null,
        voteAverage: null,
      },
    ],
    ...patch,
  };
}

// Uma série de duas temporadas (coleção), uma de temporada única e uma sem
// lista de temporadas (o membro é a própria série).
const ENTRIES = [
  series(1, {
    seasonList: [seasonMeta(1), seasonMeta(2)],
    seasonStates: {
      "1": { status: "watched", score: 9, notes: "nota da temporada 1" },
      "2": { status: "plan_to_watch", score: 0 },
    },
  }),
  series(2, { seasonList: [seasonMeta(1)] }),
  series(3),
];
const { groups: GROUPS } = buildSeasonGroups(ENTRIES);

function groupOf(tmdbId: number): SeasonGroup {
  return GROUPS.find((group) => group.key === `series-${tmdbId}`)!;
}

const SEASON_ONE = groupOf(1).members.find((member) => member.seasonNumber === 1)!;
const ONLY_SEASON = groupOf(2).members[0];
const NO_SEASONS = groupOf(3).members[0];

function setup(entry: SeasonMember, onNotesChange: ((notes: string) => void) | undefined = vi.fn()) {
  const onSeriesLoad = vi.fn();
  render(
    <SeriesWatch
      entry={entry}
      groups={GROUPS}
      autoPlay={false}
      onOpenGroup={vi.fn()}
      onCloseGroup={vi.fn()}
      onSelect={vi.fn()}
      onEdit={vi.fn()}
      onSeriesLoad={onSeriesLoad}
      onNotesChange={onNotesChange}
    />
  );
  return { onSeriesLoad };
}

beforeEach(() => {
  seriesMock.mockReset();
  seasonMock.mockReset();
  seriesMock.mockImplementation((id: number) => Promise.resolve(seriesDetail(id)));
  seasonMock.mockImplementation((_id: number, seasonNumber: number) => Promise.resolve(seasonDetail(seasonNumber)));
});

afterEach(cleanup);

describe("SeriesWatch — temporada", () => {
  // O membro se chama "Temporada 1"; o nome da série está no representante.
  it("o título do palco é o da série, e a temporada vai embaixo", async () => {
    setup(SEASON_ONE);
    expect(screen.getByRole("heading", { name: "Série 1" })).toBeTruthy();
    expect(await screen.findByText("Sinopse da temporada 1")).toBeTruthy();
    const main = screen.getByRole("heading", { name: "Série 1" }).parentElement as HTMLElement;
    expect(within(main).getByText("Temporada 1")).toBeTruthy();
  });

  it("mostra a ficha da série, a sinopse e os episódios da temporada", async () => {
    const { onSeriesLoad } = setup(SEASON_ONE);
    expect(await screen.findByText("Piloto da temporada 1")).toBeTruthy();
    expect(screen.queryByText("Sinopse da série 1")).toBeNull();
    expect(screen.getByText("Finalizada")).toBeTruthy();
    expect(seasonMock).toHaveBeenCalledWith(1, 1);
    expect(onSeriesLoad).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it("a anotação e o status são os da temporada", () => {
    setup(SEASON_ONE);
    expect(screen.getByRole("textbox")).toHaveProperty("value", "nota da temporada 1");
    const button = screen.getByTitle("Status e nota");
    expect(button.textContent).toContain("Assistido");
    expect(button.textContent).toContain("9.0");
  });

  it("o palco é o trailer da série", async () => {
    seriesMock.mockImplementation((id: number) => Promise.resolve(seriesDetail(id, { trailerKey: "sr1" })));
    setup(SEASON_ONE);
    const player = await screen.findByTitle("Trailer");
    expect(player.getAttribute("src")).toContain("/embed/sr1");
  });

  it("anda pelas temporadas da série", () => {
    setup(SEASON_ONE);
    expect(screen.getByText(/^\d \/ 2$/)).toBeTruthy();
    expect(screen.getByLabelText("Temporada anterior")).toBeTruthy();
    expect(screen.getByLabelText("Próxima temporada")).toBeTruthy();
  });

  it("série de temporada única mostra o nome da série e a temporada embaixo, sem navegação", async () => {
    setup(ONLY_SEASON);
    expect(screen.getByRole("heading", { name: "Série 2" })).toBeTruthy();
    expect(await screen.findByText("Piloto da temporada 1")).toBeTruthy();
    expect(screen.queryByLabelText("Próxima temporada")).toBeNull();
    expect(screen.getByRole("textbox")).toBeTruthy();
  });
});

describe("SeriesWatch — série sem temporadas", () => {
  it("busca só a série, mostra a sinopse dela e não tem episódios nem anotação", async () => {
    setup(NO_SEASONS);
    expect(await screen.findByText("Sinopse da série 3")).toBeTruthy();
    expect(screen.getByText("Frase da série 3")).toBeTruthy();
    expect(seasonMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Episódios", { selector: "div" })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

describe("SeriesWatch — lista", () => {
  it("lista as séries: a de várias temporadas como coleção, as outras como item", () => {
    setup(SEASON_ONE);
    const panel = within(screen.getByRole("complementary", { name: "Séries" }));
    const rows = panel.getAllByRole("listitem").map((row) => row.textContent);
    expect(rows).toHaveLength(3);
    expect(rows.some((row) => row?.includes("Série 1") && row.includes("Série · 2 temporadas") && row.includes("★ 9.0"))).toBe(true);
    expect(rows.some((row) => row?.includes("Série 2") && row.includes("2011 · Planejo Assistir"))).toBe(true);
    expect(rows.some((row) => row?.includes("Série 3") && row.includes("2015 · Assistido"))).toBe(true);
  });

  it("com a série aberta lista as temporadas dela e a saída", async () => {
    render(
      <SeriesWatch
        entry={SEASON_ONE}
        groups={GROUPS}
        openGroup={groupOf(1)}
        autoPlay={false}
        onOpenGroup={vi.fn()}
        onCloseGroup={vi.fn()}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    const panel = within(screen.getByRole("complementary", { name: "Séries" }));
    expect(panel.getByRole("button", { name: "← Todas as séries" })).toBeTruthy();
    expect(panel.getByText("2 temporadas")).toBeTruthy();
    expect(panel.getAllByRole("listitem")).toHaveLength(2);
    await waitFor(() => expect(seriesMock).toHaveBeenCalled());
  });
});
