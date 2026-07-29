import { buildCollectionGroups, pickRepresentative, type CollectionGroup } from "./buildCollectionGroups";
import type { YoutubeLibraryEntry, YoutubeLibraryStatus } from "../types/youtubeLibrary";

export type YoutubeGroup = CollectionGroup<YoutubeLibraryEntry>;

function publishedTime(entry: YoutubeLibraryEntry): number {
  return entry.publishedAt ? new Date(entry.publishedAt).getTime() : 0;
}

// Para a ordenação por data: vídeo sem data não deve virar "o mais antigo".
export function videoDateOf(entry: YoutubeLibraryEntry): number {
  return entry.publishedAt ? new Date(entry.publishedAt).getTime() : Number.POSITIVE_INFINITY;
}

export function viewsOf(entry: YoutubeLibraryEntry): number {
  return entry.viewCount ?? 0;
}

function byPublishedAsc(a: YoutubeLibraryEntry, b: YoutubeLibraryEntry): number {
  const diff = publishedTime(a) - publishedTime(b);
  return diff !== 0 ? diff : a.videoId.localeCompare(b.videoId);
}

// Ordem fixa dos membros de uma coleção: sem tag primeiro, depois tag em ordem
// alfabética e, dentro da mesma tag, publicação mais recente primeiro.
function byTagThenPublishedDesc(a: YoutubeLibraryEntry, b: YoutubeLibraryEntry): number {
  if (a.tag !== b.tag) {
    if (!a.tag) return -1;
    if (!b.tag) return 1;
    const byTag = a.tag.localeCompare(b.tag, "pt-BR", { sensitivity: "base" });
    if (byTag !== 0) return byTag;
  }
  return -byPublishedAsc(a, b);
}

export function buildYoutubeCollectionGroups(entries: YoutubeLibraryEntry[]): YoutubeGroup[] {
  return buildCollectionGroups(entries, {
    getKey: (e) => (e.collectionId != null ? `collection-${e.collectionId}` : `single-${e.videoId}`),
    compareMembers: byPublishedAsc,
  });
}

export function applyStatusView(groups: YoutubeGroup[], status: YoutubeLibraryStatus): YoutubeGroup[] {
  const result: YoutubeGroup[] = [];
  for (const g of groups) {
    const isCollection = g.representative.collectionId != null;

    // Coleção reduz aos membros da aba ativa (curtidos/removidos); denominador =
    // total da coleção (não muda), numerador = quantidade mostrada. Ex.: 3/4, 1/4.
    if (isCollection) {
      const matched = g.members.filter((m) => m.status === status);
      if (matched.length === 0) continue;
      // `pickRepresentative` continua recebendo a lista em ordem de publicação
      // asc (capa = isCover, senão o mais antigo): a ordenação por tag é só dos
      // membros, a capa não muda.
      const ordered = [...matched].sort(byPublishedAsc);
      result.push({
        key: g.key,
        representative: pickRepresentative(ordered),
        members: [...matched].sort(byTagThenPublishedDesc),
        count: g.count,
        completedCount: ordered.length,
      });
    } else if (g.representative.status === status) {
      result.push(g);
    }
  }
  return result;
}
