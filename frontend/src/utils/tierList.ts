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

export interface TierTile {
  key: string;
  media: TierMedia;
  // Id externo do representante da coleção: é o que abre o drawer.
  externalId: number;
  title: string;
  cover: string | null;
  // Média da coleção inteira (0 = sem nota). Não muda com o filtro de ano.
  score: number;
  row: TierRowId;
  // Anos em que algum membro foi concluído; vazio em "dropped".
  years: number[];
  count: number;
}

export interface TierAdapter<T> {
  externalId: (representative: T) => number;
  title: (representative: T) => string;
  cover: (representative: T) => string | null;
  status: (member: T) => string;
  completedAt: (member: T) => string | null;
  // Concluído e revisita: a revisita já foi consumida uma vez.
  done: readonly string[];
}

export const ANIME_TIER: TierAdapter<LibraryEntry> = {
  externalId: (e) => e.anilistId,
  title: (e) => e.title,
  cover: (e) => e.coverImage,
  status: (e) => e.status,
  completedAt: (e) => e.watchedAt,
  done: ["watched", "rewatching"],
};

export const MOVIE_TIER: TierAdapter<MovieLibraryEntry> = {
  externalId: (e) => e.tmdbId,
  title: (e) => e.title,
  cover: (e) => e.posterImage,
  status: (e) => e.status,
  completedAt: (e) => e.watchedAt,
  done: ["watched", "rewatching"],
};

// Temporada não tem data de conclusão própria: o que existe é o último acesso.
export const SERIES_TIER: TierAdapter<SeasonMember> = {
  externalId: (m) => m.tmdbId,
  title: (m) => m.title,
  cover: (m) => m.poster,
  status: (m) => m.status,
  completedAt: (m) => m.lastAccessAt,
  done: ["watched", "rewatching"],
};

export const GAME_TIER: TierAdapter<GameLibraryEntry> = {
  externalId: (e) => e.igdbId,
  title: (e) => e.title,
  cover: (e) => e.backgroundImage,
  status: (e) => e.status,
  completedAt: (e) => e.finishedAt,
  done: ["beaten", "replaying"],
};

export const BOOK_TIER: TierAdapter<BookLibraryEntry> = {
  externalId: (e) => e.hardcoverId,
  title: (e) => e.title,
  cover: (e) => e.coverImage,
  status: (e) => e.status,
  completedAt: (e) => e.readAt,
  done: ["read", "rereading"],
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
    const completed = group.members.filter((m) => adapter.done.includes(adapter.status(m)));
    const score = averageScore(group.members);

    let row: TierRowId;
    if (completed.length > 0) row = score > 0 ? bandOf(score) : "unrated";
    else if (group.members.some((m) => adapter.status(m) === "dropped")) row = "dropped";
    else continue;

    const years = new Set<number>();
    for (const member of completed) {
      const year = yearOf(adapter.completedAt(member));
      if (year !== null) years.add(year);
    }

    tiles.push({
      key: group.key,
      media,
      externalId: adapter.externalId(group.representative),
      title: adapter.title(group.representative),
      cover: adapter.cover(group.representative),
      score,
      row,
      years: [...years].sort((a, b) => b - a),
      count: group.count,
    });
  }

  return tiles;
}

function byScoreThenTitle(a: TierTile, b: TierTile): number {
  if (a.score !== b.score) return b.score - a.score;
  return a.title.localeCompare(b.title, "pt-BR");
}

// `year` nulo = todos os anos. Com ano, só passa a coleção que teve membro
// concluído nele — e ela mantém a faixa da média inteira, então a mesma coleção
// aparece igual em cada ano em que foi assistida. "dropped" não tem data e some.
export function groupTierRows(
  tiles: readonly TierTile[],
  year: number | null
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

  for (const tile of tiles) {
    if (year !== null && !tile.years.includes(year)) continue;
    rows[tile.row].push(tile);
  }

  for (const id of TIER_ROW_ORDER) rows[id].sort(byScoreThenTitle);
  return rows;
}

export function tierYears(tiles: readonly TierTile[]): number[] {
  const years = new Set<number>();
  for (const tile of tiles) for (const year of tile.years) years.add(year);
  return [...years].sort((a, b) => b - a);
}

export function countUnrated(tiles: readonly TierTile[]): number {
  return tiles.filter((tile) => tile.row === "unrated").length;
}
