import { useLibraryStore } from "../context/libraryStore";
import * as bookLibraryService from "../services/bookLibraryService";
import type { BookLibraryEntry, CreateBookLibraryEntry, UpdateBookLibraryEntry } from "../types/bookLibrary";

export function useBookLibrary() {
  const store = useLibraryStore<BookLibraryEntry, CreateBookLibraryEntry, UpdateBookLibraryEntry>(
    "book",
    bookLibraryService,
    (entry) => entry.hardcoverId,
    // Sem este 4º argumento o setCover otimista não limpa o isCover do irmão localmente,
    // e dois membros ficariam marcados como capa até o próximo fetch.
    (entry) => entry.collectionId
  );
  return { ...store, findByHardcoverId: store.findByExternalId };
}
