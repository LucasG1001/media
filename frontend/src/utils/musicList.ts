import type { MusicLibraryEntry, MusicLibraryStatus, MusicCard } from "../types/musicLibrary";
import type { CollectionGroup } from "./buildCollectionGroups";
import type { SortDir } from "../hooks/useSingleSort";
import { lastAccessTimeOf } from "./lastAccess";

export type MusicGroup = CollectionGroup<MusicLibraryEntry>;

export interface MusicListOptions {
  status: MusicLibraryStatus;
  search: string;
  sortField: string;
  sortDir: SortDir;
}

// Música sem data não deve virar "a mais antiga".
function dateOf(entry: MusicLibraryEntry): number {
  return entry.publishedAt ? new Date(entry.publishedAt).getTime() : Number.POSITIVE_INFINITY;
}

// Comparação explícita em vez de subtração: Infinity - Infinity é NaN e deixaria
// a ordem das sem data indefinida.
function compareNumbers(a: number, b: number): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function comparatorFor(field: string): (a: MusicLibraryEntry, b: MusicLibraryEntry) => number {
  switch (field) {
    case "date":
      return (a, b) => compareNumbers(dateOf(a), dateOf(b));
    case "views":
      return (a, b) => compareNumbers(a.viewCount ?? 0, b.viewCount ?? 0);
    case "access":
      return (a, b) => compareNumbers(lastAccessTimeOf(a), lastAccessTimeOf(b));
    default:
      return (a, b) => a.title.localeCompare(b.title, "pt", { sensitivity: "base" });
  }
}

function matchesSearch(entry: MusicLibraryEntry, query: string): boolean {
  if (!query) return true;
  return (
    entry.title.toLowerCase().includes(query) ||
    (entry.channelTitle ?? "").toLowerCase().includes(query)
  );
}

// A lista que está na tela: aba de status → busca (título/canal) → ordenação. É
// também a sequência do anterior/próximo do drawer, já que não há coleção para
// delimitá-la. O desempate por videoId não inverte com a direção: é só o que
// impede a ordem de trocar entre renders.
export function visibleTracks(entries: MusicLibraryEntry[], options: MusicListOptions): MusicLibraryEntry[] {
  const query = options.search.trim().toLowerCase();
  const compare = comparatorFor(options.sortField);
  const sign = options.sortDir === "desc" ? -1 : 1;
  return entries
    .filter((entry) => entry.status === options.status && matchesSearch(entry, query))
    .sort((a, b) => sign * compare(a, b) || a.videoId.localeCompare(b.videoId));
}

// O FranchiseGrid trabalha sobre grupos; aqui cada música é um grupo de um só.
export function toMusicGroups(tracks: MusicLibraryEntry[]): MusicGroup[] {
  return tracks.map((track) => ({
    key: `track-${track.videoId}`,
    representative: track,
    members: [track],
    count: 1,
    completedCount: 1,
  }));
}

export function musicLibraryEntryToCard(entry: MusicLibraryEntry): MusicCard {
  return {
    id: entry.videoId,
    title: entry.title,
    thumbnail: entry.thumbnail,
    channelTitle: entry.channelTitle,
    channelThumbnail: entry.channelThumbnail,
    durationSeconds: entry.durationSeconds,
    viewCount: entry.viewCount,
  };
}
