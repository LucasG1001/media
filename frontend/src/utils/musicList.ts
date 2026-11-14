import type { MusicLibraryEntry, MusicLibraryStatus } from "../types/musicLibrary";
import type { SortDir } from "../hooks/useSingleSort";
import { lastAccessTimeOf } from "./lastAccess";

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

// A lista da tela de reprodução: aba de status → busca (título/canal) →
// ordenação. O desempate por videoId não inverte com a direção: é só o que
// impede a ordem de trocar entre renders.
export function visibleTracks(entries: MusicLibraryEntry[], options: MusicListOptions): MusicLibraryEntry[] {
  const query = options.search.trim().toLowerCase();
  const compare = comparatorFor(options.sortField);
  const sign = options.sortDir === "desc" ? -1 : 1;
  return entries
    .filter((entry) => entry.status === options.status && matchesSearch(entry, query))
    .sort((a, b) => sign * compare(a, b) || a.videoId.localeCompare(b.videoId));
}

export interface TrackNeighbors {
  previous?: MusicLibraryEntry;
  next?: MusicLibraryEntry;
}

// Anterior e próxima da música atual na lista visível. A lista é circular: depois
// da última vem a primeira. Música fora da lista (a aba ou a busca a escondem)
// tem a primeira como próxima e nenhuma anterior; sozinha na lista, não tem
// vizinha.
export function trackNeighbors(tracks: MusicLibraryEntry[], currentVideoId: string): TrackNeighbors {
  const index = tracks.findIndex((track) => track.videoId === currentVideoId);
  if (index === -1) return { next: tracks[0] };
  if (tracks.length < 2) return {};
  return {
    previous: tracks[(index - 1 + tracks.length) % tracks.length],
    next: tracks[(index + 1) % tracks.length],
  };
}

// A música em que a página abre: a última tocada entre as curtidas; sem nenhuma
// tocada ainda, a primeira em ordem alfabética. Só cai nas removidas quando não
// há curtida nenhuma — biblioteca só de removidas ainda precisa abrir em algo.
export function pickInitialTrack(entries: MusicLibraryEntry[]): MusicLibraryEntry | undefined {
  const liked = entries.filter((entry) => entry.status === "liked");
  const pool = liked.length > 0 ? liked : entries;
  if (pool.length === 0) return undefined;
  const byAccess = [...pool].sort(
    (a, b) => compareNumbers(lastAccessTimeOf(b), lastAccessTimeOf(a)) || comparatorFor("alpha")(a, b) || a.videoId.localeCompare(b.videoId)
  );
  return byAccess[0];
}
