import type { BookCard } from "../types/book";
import type { BookLibraryEntry } from "../types/bookLibrary";

export function bookLibraryEntryToCard(entry: BookLibraryEntry): BookCard {
  return {
    id: entry.hardcoverId,
    title: entry.title,
    slug: null,
    coverImage: entry.coverImage,
    authors: entry.authors ? entry.authors.split(", ") : [],
    publishedDate: entry.publishedDate,
    releaseYear: entry.publishedDate ? Number(entry.publishedDate.slice(0, 4)) : null,
    // Na biblioteca a nota exibida vem de libraryEntry.score (e da média dos membros na
    // capa da coleção), nunca da nota da comunidade.
    averageRating: null,
    ratingsCount: null,
    pageCount: entry.pageCount,
    bookStatus: entry.bookStatus || "RELEASED",
    seriesId: entry.collectionId,
    seriesName: entry.seriesName,
    seriesPosition: entry.seriesPosition,
  };
}
