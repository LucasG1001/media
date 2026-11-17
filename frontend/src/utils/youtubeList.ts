import type {
  YoutubeLibraryEntry,
  YoutubeLibraryStatus,
  YoutubeKind,
  YoutubePlaylist,
} from "../types/youtubeLibrary";
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

export interface PlaylistGroup {
  id: string;
  name: string;
  tracks: YoutubeLibraryEntry[];
}

// As playlists de uma aba, em ordem alfabética — é a lista dos menus.
export function playlistsOfKind(playlists: YoutubePlaylist[], kind: YoutubeKind): YoutubePlaylist[] {
  return playlists
    .filter((playlist) => playlist.kind === kind)
    .sort((a, b) => compareNames(a.name, b.name) || a.id.localeCompare(b.id));
}

// O bloco de playlists da aba: cada uma com os itens **na ordem da playlist**,
// não na ordenação da lista. O vínculo de item removido ou movido para a outra
// aba continua guardado, mas o item não aparece — e volta sozinho se for
// restaurado ou movido de volta. Dos filtros, só a busca vale aqui: casa com
// título/canal dos itens (a playlist sem nenhum casando sai de vista) ou com o
// nome da playlist (que então aparece inteira). Sem busca, playlist vazia
// aparece — é assim que se vê a recém-criada.
export function playlistGroups(
  playlists: YoutubePlaylist[],
  entries: YoutubeLibraryEntry[],
  kind: YoutubeKind,
  search: string
): PlaylistGroup[] {
  const query = search.trim().toLowerCase();
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const groups: PlaylistGroup[] = [];
  for (const playlist of playlistsOfKind(playlists, kind)) {
    const members = playlist.itemIds
      .map((id) => byId.get(id))
      .filter((entry): entry is YoutubeLibraryEntry => !!entry && entry.kind === kind && entry.status === "liked");
    const nameMatches = !query || playlist.name.toLowerCase().includes(query);
    const tracks = nameMatches ? members : members.filter((entry) => matchesSearch(entry, query));
    if (!nameMatches && tracks.length === 0) continue;
    groups.push({ id: playlist.id, name: playlist.name, tracks });
  }
  return groups;
}

// FNV-1a de 32 bits: só precisa espalhar bem e ser determinístico.
function hashOf(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// Ordem aleatória da playlist. Cada item ganha uma chave que depende só da
// semente e dele mesmo: a ordem não muda entre renders (o "próximo" não pula a
// cada troca de item) e adicionar ou tirar um item não reembaralha os outros.
// Semente nova = outra ordem.
export function shuffleTracks(tracks: YoutubeLibraryEntry[], seed: number): YoutubeLibraryEntry[] {
  return tracks
    .map((track) => ({ track, key: hashOf(`${seed}:${track.videoId}`) }))
    .sort((a, b) => compareNumbers(a.key, b.key) || a.track.videoId.localeCompare(b.track.videoId))
    .map(({ track }) => track);
}

// Clique numa linha em modo de seleção. Simples: liga/desliga o item. Com Shift
// e uma âncora (o último clicado) na mesma lista: marca o intervalo inteiro
// entre os dois — só marca, não inverte, que é o que se espera de um intervalo.
export function toggleSelection(
  selected: ReadonlySet<string>,
  id: string,
  siblingIds: string[],
  anchorId: string | null
): Set<string> {
  const next = new Set(selected);
  const from = anchorId ? siblingIds.indexOf(anchorId) : -1;
  const to = siblingIds.indexOf(id);
  if (from !== -1 && to !== -1 && from !== to) {
    for (let i = Math.min(from, to); i <= Math.max(from, to); i += 1) next.add(siblingIds[i]);
  } else if (!next.delete(id)) {
    next.add(id);
  }
  return next;
}

// A caixa de um grupo (canal, playlist ou "todos"): marca o grupo inteiro; com
// todos já marcados, desmarca.
export function toggleGroupSelection(selected: ReadonlySet<string>, groupIds: string[]): Set<string> {
  const next = new Set(selected);
  const all = groupIds.length > 0 && groupIds.every((id) => next.has(id));
  for (const id of groupIds) {
    if (all) next.delete(id);
    else next.add(id);
  }
  return next;
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
