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
      const ordered = [...matched].sort(byPublishedAsc);
      result.push({
        key: g.key,
        representative: pickRepresentative(ordered),
        members: [...ordered].reverse(),
        count: g.count,
        completedCount: ordered.length,
      });
    } else if (g.representative.status === status) {
      result.push(g);
    }
  }
  return result;
}
