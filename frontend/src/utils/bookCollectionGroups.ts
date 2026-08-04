import { buildCollectionGroups, type CollectionGroup } from "./buildCollectionGroups";
import type { BookLibraryEntry } from "../types/bookLibrary";

export type BookGroup = CollectionGroup<BookLibraryEntry>;

export function pubTimeOf(entry: BookLibraryEntry): number {
  return entry.publishedDate ? new Date(entry.publishedDate).getTime() : Number.POSITIVE_INFINITY;
}

export function readTimeOf(entry: BookLibraryEntry): number {
  return entry.readAt ? new Date(entry.readAt).getTime() : 0;
}

export function positionOf(entry: BookLibraryEntry): number {
  return entry.seriesPosition ?? Number.POSITIVE_INFINITY;
}

// Livros são a única mídia cuja expansão ordena por um campo GUARDADO da API
// (series_position) e não pela data: a posição na série é 0.5, 3.5, 7.5 e é ela que dá
// a ordem de leitura. Posição nula (livro fora de série) vai para o fim.
function bySeriesPosition(a: BookLibraryEntry, b: BookLibraryEntry): number {
  const pa = positionOf(a);
  const pb = positionOf(b);
  if (pa !== pb) return pa - pb;
  const ta = pubTimeOf(a);
  const tb = pubTimeOf(b);
  if (ta !== tb) return ta - tb;
  return a.title.localeCompare(b.title);
}

export function buildBookCollectionGroups(
  entries: BookLibraryEntry[],
  memberFilter?: (entry: BookLibraryEntry) => boolean
): BookGroup[] {
  return buildCollectionGroups(entries, {
    getKey: (e) => (e.collectionId != null ? `collection-${e.collectionId}` : `single-${e.hardcoverId}`),
    compareMembers: bySeriesPosition,
    // Ao contrário das outras mídias, a expansão não é invertida: a ordem crescente de
    // posição é a ordem de leitura.
    reverseMembers: false,
    memberFilter,
  });
}
