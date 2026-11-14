import type { YoutubeLibraryEntry, YoutubeLibraryStatus, YoutubeKind } from "../types/youtubeLibrary";
import type { SortDir } from "../hooks/useSingleSort";
import { lastAccessTimeOf } from "./lastAccess";

export interface YoutubeListOptions {
  kind: YoutubeKind;
  status: YoutubeLibraryStatus;
  search: string;
  sortField: string;
  sortDir: SortDir;
}

// Item sem data não deve virar "o mais antigo".
function dateOf(entry: YoutubeLibraryEntry): number {
  return entry.publishedAt ? new Date(entry.publishedAt).getTime() : Number.POSITIVE_INFINITY;
}

// Comparação explícita em vez de subtração: Infinity - Infinity é NaN e deixaria
// a ordem dos sem data indefinida.
function compareNumbers(a: number, b: number): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function compareNames(a: string, b: string): number {
  return a.localeCompare(b, "pt", { sensitivity: "base" });
}

function comparatorFor(field: string): (a: YoutubeLibraryEntry, b: YoutubeLibraryEntry) => number {
  switch (field) {
    case "date":
      return (a, b) => compareNumbers(dateOf(a), dateOf(b));
    case "views":
      return (a, b) => compareNumbers(a.viewCount ?? 0, b.viewCount ?? 0);
    case "access":
      return (a, b) => compareNumbers(lastAccessTimeOf(a), lastAccessTimeOf(b));
    default:
      return (a, b) => compareNames(a.title, b.title);
  }
}

function matchesSearch(entry: YoutubeLibraryEntry, query: string): boolean {
  if (!query) return true;
  return (
    entry.title.toLowerCase().includes(query) ||
    (entry.channelTitle ?? "").toLowerCase().includes(query)
  );
}

// A lista da tela de reprodução: aba de tipo (músicas/vídeos) → aba de status →
// busca (título/canal) → ordenação. O desempate por videoId não inverte com a
// direção: é só o que impede a ordem de trocar entre renders.
export function visibleTracks(entries: YoutubeLibraryEntry[], options: YoutubeListOptions): YoutubeLibraryEntry[] {
  const query = options.search.trim().toLowerCase();
  const compare = comparatorFor(options.sortField);
  const sign = options.sortDir === "desc" ? -1 : 1;
  return entries
    .filter(
      (entry) => entry.kind === options.kind && entry.status === options.status && matchesSearch(entry, query)
    )
    .sort((a, b) => sign * compare(a, b) || a.videoId.localeCompare(b.videoId));
}

export interface ChannelGroup {
  key: string;
  name: string;
  thumbnail: string | null;
  tracks: YoutubeLibraryEntry[];
}

const UNKNOWN_CHANNEL = "Canal desconhecido";

// O id é a identidade do canal (o nome pode mudar e pode repetir); item antigo
// sem id cai no nome, e sem os dois vai tudo para um grupo só.
export function channelKeyOf(entry: YoutubeLibraryEntry): string {
  return entry.channelId ?? entry.channelTitle ?? "";
}

function groupSortValue(group: ChannelGroup, field: string): number {
  switch (field) {
    case "views":
      return group.tracks.reduce((total, track) => total + (track.viewCount ?? 0), 0);
    case "access":
      return Math.max(...group.tracks.map(lastAccessTimeOf));
    case "date": {
      // Publicação mais recente do canal. Só as datadas contam; canal sem
      // nenhuma data segue a regra dos itens sem data.
      const dated = group.tracks.map(dateOf).filter(Number.isFinite);
      return dated.length > 0 ? Math.max(...dated) : Number.POSITIVE_INFINITY;
    }
    default:
      return 0;
  }
}

// Agrupa por canal a lista **já recortada e ordenada** por `visibleTracks`:
// dentro de cada canal os itens ficam na ordem em que chegaram (a ordenação
// normal), e os canais seguem o mesmo critério, agregado — alfabética = nome do
// canal, visualizações = soma, data = publicação mais recente, último acesso =
// acesso mais recente.
export function channelGroups(
  tracks: YoutubeLibraryEntry[],
  sortField: string,
  sortDir: SortDir
): ChannelGroup[] {
  const byKey = new Map<string, ChannelGroup>();
  for (const track of tracks) {
    const key = channelKeyOf(track);
    const group = byKey.get(key);
    if (group) {
      group.tracks.push(track);
      group.thumbnail ??= track.channelThumbnail;
    } else {
      byKey.set(key, {
        key,
        name: track.channelTitle ?? UNKNOWN_CHANNEL,
        thumbnail: track.channelThumbnail,
        tracks: [track],
      });
    }
  }

  const sign = sortDir === "desc" ? -1 : 1;
  const byName = sortField !== "views" && sortField !== "access" && sortField !== "date";
  return [...byKey.values()].sort((a, b) => {
    const primary = byName
      ? compareNames(a.name, b.name)
      : compareNumbers(groupSortValue(a, sortField), groupSortValue(b, sortField));
    return sign * primary || a.key.localeCompare(b.key);
  });
}

export interface TrackNeighbors {
  previous?: YoutubeLibraryEntry;
  next?: YoutubeLibraryEntry;
}

// Anterior e próximo do item atual na lista visível. A lista é circular: depois
// do último vem o primeiro. Item fora da lista (a aba ou a busca o escondem) tem
// o primeiro como próximo e nenhum anterior; sozinho na lista, não tem vizinho.
export function trackNeighbors(tracks: YoutubeLibraryEntry[], currentVideoId: string): TrackNeighbors {
  const index = tracks.findIndex((track) => track.videoId === currentVideoId);
  if (index === -1) return { next: tracks[0] };
  if (tracks.length < 2) return {};
  return {
    previous: tracks[(index - 1 + tracks.length) % tracks.length],
    next: tracks[(index + 1) % tracks.length],
  };
}

// O item em que a página abre: o último tocado entre os curtidos, de qualquer
// tipo; sem nenhum tocado ainda, o primeiro em ordem alfabética. Só cai nos
// removidos quando não há curtido nenhum — biblioteca só de removidos ainda
// precisa abrir em algo.
export function pickInitialTrack(entries: YoutubeLibraryEntry[]): YoutubeLibraryEntry | undefined {
  const liked = entries.filter((entry) => entry.status === "liked");
  const pool = liked.length > 0 ? liked : entries;
  if (pool.length === 0) return undefined;
  const byAccess = [...pool].sort(
    (a, b) =>
      compareNumbers(lastAccessTimeOf(b), lastAccessTimeOf(a)) ||
      compareNames(a.title, b.title) ||
      a.videoId.localeCompare(b.videoId)
  );
  return byAccess[0];
}
