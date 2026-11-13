import type { CollectionGroup } from "./buildCollectionGroups";
import { averageScore } from "./librarySort";
import type { SeasonMember } from "./seasonGroups";
import type { LibraryEntry } from "../types/library";
import type { MovieLibraryEntry } from "../types/movieLibrary";
import type { GameLibraryEntry } from "../types/gameLibrary";
import type { BookLibraryEntry } from "../types/bookLibrary";

export type TierMedia = "anime" | "movie" | "series" | "game" | "book";
export type TierBandId = "top" | "good" | "mid" | "low" | "bottom";
export type TierRowId = TierBandId | "dropped" | "unrated";

export const TIER_BANDS: readonly { id: TierBandId; min: number }[] = [
  { id: "top", min: 9 },
  { id: "good", min: 7 },
  { id: "mid", min: 5 },
  { id: "low", min: 3 },
  { id: "bottom", min: 0 },
];

export const TIER_ROW_ORDER: readonly TierRowId[] = [
  "top",
  "good",
  "mid",
  "low",
  "bottom",
  "dropped",
  "unrated",
];

// A faixa sai da nota arredondada a uma casa — a mesma que o card mostra. Sem
// isso uma média 8,97 apareceria como "9.0" dentro de "Bom".
export function bandOf(score: number): TierBandId {
  const shown = Math.round(score * 10) / 10;
  const band = TIER_BANDS.find((b) => shown >= b.min);
  return (band ?? TIER_BANDS[TIER_BANDS.length - 1]).id;
}

export function bandRangeLabel(id: TierBandId): string {
  const index = TIER_BANDS.findIndex((b) => b.id === id);
  const min = TIER_BANDS[index].min;
  const from = min > 0 ? String(min).replace(".", ",") : "0,5";
  if (index === 0) return `Nota ${from} a 10`;
  const below = String(TIER_BANDS[index - 1].min).replace(".", ",");
  return `Nota ${from} até abaixo de ${below}`;
}

// Um membro que conta para os filtros de ano: quando foi lançado e quando foi
// concluído. Os dois ficam juntos porque os filtros combinados valem para o
// mesmo membro. Capa, título e id são os dele: com ano filtrado a peça passa a
// mostrar (e abrir) esse membro em vez do representante da coleção.
export interface TierMark {
  released: number | null;
  completed: number | null;
  externalId: number;
  title: string;
  cover: string | null;
}

export interface TierYearFilter {
  released: number | null;
  completed: number | null;
}

export const NO_YEAR_FILTER: TierYearFilter = { released: null, completed: null };

export interface TierTile {
  key: string;
  media: TierMedia;
  // Id externo do representante da coleção: é o que abre o drawer.
  externalId: number;
  title: string;
  cover: string | null;
  // Média da coleção inteira (0 = sem nota). Não muda com os filtros de ano.
  score: number;
  row: TierRowId;
  // Membros concluídos; em "dropped", os abandonados (sem ano de conclusão).
  // Em ordem de lançamento, do mais antigo para o mais novo.
  marks: TierMark[];
  count: number;
}

export interface TierAdapter<T> {
  externalId: (member: T) => number;
  title: (member: T) => string;
  cover: (member: T) => string | null;
  status: (member: T) => string;
  completedAt: (member: T) => string | null;
  releasedYear: (member: T) => number | null;
  // Concluído e revisita: a revisita já foi consumida uma vez.
  done: readonly string[];
  // `group.members` vem na ordem da expansão da biblioteca, que é invertida
  // (mais novo primeiro) em anime, filmes e jogos.
  newestFirst: boolean;
  // Título do membro quando ele sozinho não identifica a obra (temporada).
  memberTitle?: (member: T, representative: T) => string;
}

// Data de lançamento vem como "AAAA-MM-DD". O ano sai do texto, não de `Date`:
// data sem hora é lida como meia-noite UTC, e em fuso negativo 1º de janeiro
// viraria 31 de dezembro do ano anterior.
export function releaseYearOf(date: string | null | undefined): number | null {
  if (!date) return null;
  const match = /^(\d{4})/.exec(date);
  if (match) return Number(match[1]);
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getFullYear();
}

export const ANIME_TIER: TierAdapter<LibraryEntry> = {
  externalId: (e) => e.anilistId,
  title: (e) => e.title,
  cover: (e) => e.coverImage,
  status: (e) => e.status,
  completedAt: (e) => e.watchedAt,
  releasedYear: (e) => e.seasonYear ?? releaseYearOf(e.endDate),
  done: ["watched", "rewatching"],
  newestFirst: true,
};

export const MOVIE_TIER: TierAdapter<MovieLibraryEntry> = {
  externalId: (e) => e.tmdbId,
  title: (e) => e.title,
  cover: (e) => e.posterImage,
  status: (e) => e.status,
  completedAt: (e) => e.watchedAt,
  releasedYear: (e) => releaseYearOf(e.releaseDate),
  done: ["watched", "rewatching"],
  newestFirst: true,
};

// Temporada não tem data de conclusão própria: o que existe é o último acesso.
export const SERIES_TIER: TierAdapter<SeasonMember> = {
  externalId: (m) => m.tmdbId,
  title: (m) => m.title,
  cover: (m) => m.poster,
  status: (m) => m.status,
  completedAt: (m) => m.lastAccessAt,
  releasedYear: (m) => releaseYearOf(m.airDate),
  done: ["watched", "rewatching"],
  newestFirst: false,
  memberTitle: (m, representative) =>
    m.kind === "season" && !m.isOnlySeason ? `${representative.title} · ${m.title}` : m.title,
};

export const GAME_TIER: TierAdapter<GameLibraryEntry> = {
  externalId: (e) => e.igdbId,
  title: (e) => e.title,
  cover: (e) => e.backgroundImage,
  status: (e) => e.status,
  completedAt: (e) => e.finishedAt,
  releasedYear: (e) => releaseYearOf(e.released),
  done: ["beaten", "replaying"],
  newestFirst: true,
};

export const BOOK_TIER: TierAdapter<BookLibraryEntry> = {
  externalId: (e) => e.hardcoverId,
  title: (e) => e.title,
  cover: (e) => e.coverImage,
  status: (e) => e.status,
  completedAt: (e) => e.readAt,
  releasedYear: (e) => releaseYearOf(e.publishedDate),
  done: ["read", "rereading"],
  newestFirst: false,
};

function yearOf(iso: string | null): number | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getFullYear();
}

// Uma peça por coleção. Entra quem tem algum membro concluído (faixa pela média,
// ou "unrated" sem nota) e quem não tem nenhum concluído mas tem abandonado
// ("dropped"). Coleção só planejada fica de fora.
export function buildTierTiles<T extends { score: number }>(
  media: TierMedia,
  groups: readonly CollectionGroup<T>[],
  adapter: TierAdapter<T>
): TierTile[] {
  const tiles: TierTile[] = [];

  for (const group of groups) {
    const chronological = adapter.newestFirst ? [...group.members].reverse() : group.members;
    const completed = chronological.filter((m) => adapter.done.includes(adapter.status(m)));
    const score = averageScore(group.members);

    const markOf = (member: T, completedYear: number | null): TierMark => ({
      released: adapter.releasedYear(member),
      completed: completedYear,
      externalId: adapter.externalId(member),
      title: adapter.memberTitle ? adapter.memberTitle(member, group.representative) : adapter.title(member),
      cover: adapter.cover(member),
    });

    let row: TierRowId;
    let marks: TierMark[];
    if (completed.length > 0) {
      row = score > 0 ? bandOf(score) : "unrated";
      marks = completed.map((m) => markOf(m, yearOf(adapter.completedAt(m))));
    } else {
      // Membro só planejado nunca marca ano: uma sequência ainda não vista não
      // pode colocar a coleção no ano dela.
      const dropped = chronological.filter((m) => adapter.status(m) === "dropped");
      if (dropped.length === 0) continue;
      row = "dropped";
      marks = dropped.map((m) => markOf(m, null));
    }

    tiles.push({
      key: group.key,
      media,
      externalId: adapter.externalId(group.representative),
      title: adapter.title(group.representative),
      cover: adapter.cover(group.representative),
      score,
      row,
      marks,
      count: group.count,
    });
  }

  return tiles;
}

function byScoreThenTitle(a: TierTile, b: TierTile): number {
  if (a.score !== b.score) return b.score - a.score;
  return a.title.localeCompare(b.title, "pt-BR");
}

// Os filtros só decidem quem aparece: a coleção mantém a faixa da média inteira,
// então aparece igual em cada ano em que bate. Os dois anos juntos precisam bater
// no MESMO membro (lançado em X e concluído em Y). "dropped" não tem ano de
// conclusão, então some com esse filtro e aparece com o de lançamento.
//
// Com ano filtrado a peça troca capa, título e id pelos do primeiro membro que
// bate (o mais antigo): "lançado em 2024" mostra e abre a temporada de 2024, não
// a capa escolhida para a coleção. Membro sem capa cai na da coleção.
function markMatches(mark: TierMark, filter: TierYearFilter): boolean {
  return (
    (filter.released === null || mark.released === filter.released) &&
    (filter.completed === null || mark.completed === filter.completed)
  );
}

export function groupTierRows(
  tiles: readonly TierTile[],
  filter: TierYearFilter = NO_YEAR_FILTER
): Record<TierRowId, TierTile[]> {
  const rows: Record<TierRowId, TierTile[]> = {
    top: [],
    good: [],
    mid: [],
    low: [],
    bottom: [],
    dropped: [],
    unrated: [],
  };

  const filtering = filter.released !== null || filter.completed !== null;
  for (const tile of tiles) {
    if (!filtering) {
      rows[tile.row].push(tile);
      continue;
    }
    const mark = tile.marks.find((m) => markMatches(m, filter));
    if (!mark) continue;
    rows[tile.row].push({
      ...tile,
      externalId: mark.externalId,
      title: mark.title,
      cover: mark.cover ?? tile.cover,
    });
  }

  for (const id of TIER_ROW_ORDER) rows[id].sort(byScoreThenTitle);
  return rows;
}

export function tierYears(tiles: readonly TierTile[], kind: "released" | "completed"): number[] {
  const years = new Set<number>();
  for (const tile of tiles) {
    for (const mark of tile.marks) {
      const year = mark[kind];
      if (year !== null) years.add(year);
    }
  }
  return [...years].sort((a, b) => b - a);
}

export function countUnrated(tiles: readonly TierTile[]): number {
  return tiles.filter((tile) => tile.row === "unrated").length;
}
