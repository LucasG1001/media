import { useState, useEffect, useCallback, useMemo } from "react";
import { TabNav } from "../../components/TabNav/TabNav";
import { MediaGrid } from "../../components/MediaGrid/MediaGrid";
import { FranchiseGrid } from "../../components/FranchiseGrid/FranchiseGrid";
import { bookCardConfig } from "../../config/cards";
import { BookDrawer } from "../../components/BookDrawer/BookDrawer";
import { BookLibraryModal } from "../../components/BookLibraryModal/BookLibraryModal";
import { SearchBar } from "../../components/SearchBar/SearchBar";
import { useBooks } from "../../hooks/useBooks";
import { useBookLibrary } from "../../hooks/useBookLibrary";
import { useDebounce } from "../../hooks/useDebounce";
import { useSingleSort } from "../../hooks/useSingleSort";
import { LibraryControls } from "../../components/LibraryControls/LibraryControls";
import type { BookCard, BookDetail } from "../../types/book";
import type { BookLibraryStatus, BookLibraryEntry } from "../../types/bookLibrary";
import { BOOK_LIBRARY_STATUS_LABELS } from "../../types/bookLibrary";
import { BOOK_GENRES } from "../../utils/bookGenres";
import { buildBookCollectionGroups, authorKey, pubTimeOf, readTimeOf } from "../../utils/bookCollectionGroups";
import { bookLibraryEntryToCard } from "../../utils/bookLibraryEntryToCard";
import { filterGroupsBySearch } from "../../utils/filterGroupsBySearch";
import { sortGroupsByAvgScore, sortGroupsByMemberDate } from "../../utils/sortGroups";
import styles from "./BooksPage.module.css";

const TABS = [
  { id: "discover", label: "Descobrir" },
  { id: "search", label: "Buscar" },
  { id: "library", label: "Minha Biblioteca" },
];

const STATUS_OPTIONS = Object.entries(BOOK_LIBRARY_STATUS_LABELS) as [BookLibraryStatus, string][];

export function BooksPage() {
  const [activeTab, setActiveTab] = useState("library");
  const [searchQuery, setSearchQuery] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedBookForModal, setSelectedBookForModal] = useState<BookCard | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<BookLibraryStatus[]>([]);
  const sort = useSingleSort("published");
  const [selectedGenre, setSelectedGenre] = useState(BOOK_GENRES[0].value);
  const debouncedSearch = useDebounce(searchQuery, 400);

  const { books, loading, error, hasNextPage, loadByGenre, search, loadMore, reset } = useBooks();
  const {
    entries: libraryEntries,
    loading: libraryLoading,
    error: libraryError,
    add: addEntry,
    update: updateEntry,
    updateMany: updateManyEntries,
    setCover: setCoverEntry,
    remove: removeEntry,
    removeMany: removeManyEntries,
    findByGoogleBooksId,
  } = useBookLibrary();

  useEffect(() => {
    if (activeTab === "discover") {
      loadByGenre(selectedGenre);
    }
  }, [activeTab, selectedGenre, loadByGenre]);

  useEffect(() => {
    if (activeTab !== "search") return;
    if (debouncedSearch.length >= 2) search(debouncedSearch);
    else reset();
  }, [debouncedSearch, activeTab, search, reset]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSearchQuery("");
    setLibrarySearch("");
  };

  const handleCardClick = (book: BookCard) => {
    setSelectedBookId(book.id);
  };

  const handleOpenLibraryModal = useCallback((book: BookCard) => {
    setSelectedBookForModal(book);
  }, []);

  const handleModalSave = useCallback((book: BookCard, data: { status: BookLibraryStatus; score: number }) => {
    const existing = findByGoogleBooksId(book.id);
    if (existing) {
      updateEntry(existing.id, data);
    } else {
      addEntry({
        googleBooksId: book.id,
        title: book.title,
        coverImage: book.coverImage,
        authors: book.authors.length > 0 ? book.authors.join(", ") : null,
        publishedDate: book.publishedDate,
        ...data,
      });
    }
    setSelectedBookForModal(null);
  }, [findByGoogleBooksId, updateEntry, addEntry]);

  const handleModalRemove = useCallback((id: string) => {
    removeEntry(id);
    setSelectedBookForModal(null);
  }, [removeEntry]);

  const handleBookLoad = useCallback((bookDetail: BookDetail) => {
    const entry = findByGoogleBooksId(bookDetail.id);
    if (entry) {
      const authorsStr = bookDetail.authors.length > 0 ? bookDetail.authors.join(", ") : null;
      const needsUpdate =
        entry.title !== bookDetail.title ||
        entry.coverImage !== bookDetail.coverImage ||
        entry.authors !== authorsStr ||
        entry.publishedDate !== bookDetail.publishedDate ||
        entry.pageCount !== bookDetail.pageCount;

      if (needsUpdate) {
        updateEntry(entry.id, {
          title: bookDetail.title,
          coverImage: bookDetail.coverImage,
          authors: authorsStr,
          publishedDate: bookDetail.publishedDate,
          pageCount: bookDetail.pageCount,
        });
      }
    }
  }, [findByGoogleBooksId, updateEntry]);

  const toggleLibraryFilter = (status: BookLibraryStatus) =>
    setLibraryFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );

  const collectionGroups = useMemo(() => {
    const hasFilter = libraryFilter.length > 0;
    const memberFilter = hasFilter
      ? (m: BookLibraryEntry) => libraryFilter.includes(m.status as BookLibraryStatus)
      : undefined;
    let groups = buildBookCollectionGroups(libraryEntries, memberFilter);
    if (!hasFilter) {
      groups = groups.filter((g) => g.members.some((m) => m.status !== "dropped"));
    }
    groups =
      sort.field === "score"
        ? sortGroupsByAvgScore(groups, sort.dir)
        : sort.field === "read"
        ? sortGroupsByMemberDate(groups, readTimeOf, sort.dir, "latest")
        : sortGroupsByMemberDate(groups, pubTimeOf, sort.dir);
    return filterGroupsBySearch(groups, librarySearch);
  }, [libraryEntries, libraryFilter, sort.field, sort.dir, librarySearch]);

  const gridKey =
    activeTab === "library"
      ? `library-${libraryFilter.join(",")}-${sort.field}-${sort.dir}-${librarySearch}`
      : activeTab === "search"
      ? `search-${debouncedSearch}`
      : `discover-${selectedGenre}`;

  const drawerEntry = selectedBookId !== null ? findByGoogleBooksId(selectedBookId) : undefined;

  return (
    <div className={styles.page}>
      <h1 className={styles.srOnly}>Livros</h1>

      <div className={styles.tabWrapper}>
        <TabNav tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      {activeTab === "discover" && (
        <div className={styles.selectorWrapper}>
          <select
            className={styles.filterSelect}
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
          >
            {BOOK_GENRES.map((genre) => (
              <option key={genre.value} value={genre.value}>
                {genre.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {activeTab === "search" && (
        <div className={styles.searchWrapper}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            loading={loading && searchQuery.length > 0}
            placeholder="Buscar livro..."
          />
        </div>
      )}

      {activeTab === "library" && (
        <LibraryControls
          searchValue={librarySearch}
          onSearchChange={setLibrarySearch}
          count={collectionGroups.length}
          filterGroups={[
            {
              key: "status",
              title: "Status",
              options: STATUS_OPTIONS.map(([value, label]) => ({ value, label })),
              selected: libraryFilter,
              onToggle: (v) => toggleLibraryFilter(v as BookLibraryStatus),
            },
          ]}
          onClearFilters={() => setLibraryFilter([])}
          sort={{
            active: sort.field,
            dir: sort.dir,
            options: [
              { field: "published", label: "Publicação" },
              { field: "read", label: "Leitura" },
              { field: "score", label: "Nota" },
            ],
            onSelect: sort.select,
          }}
        />
      )}

      {activeTab === "library" ? (
        <FranchiseGrid
          groups={collectionGroups}
          loading={libraryLoading}
          error={libraryError}
          cardConfig={bookCardConfig}
          entryToCard={bookLibraryEntryToCard}
          getExternalId={(e) => e.googleBooksId}
          onCardClick={handleCardClick}
          onAddToLibrary={handleOpenLibraryModal}
          getLibraryEntry={(id) => findByGoogleBooksId(id)}
          onDeleteGroup={(group) => removeManyEntries(group.members.map((m) => m.id))}
          statusLabels={BOOK_LIBRARY_STATUS_LABELS}
          onBulkSetStatus={(ids, status) => updateManyEntries(ids, status)}
          expandTitle="Ver livros do autor"
          animationKey={gridKey}
          emptyMessage="Sua biblioteca está vazia."
          emptyHint="Adicione livros para começar!"
        />
      ) : (
        <MediaGrid
          items={books}
          config={bookCardConfig}
          loading={loading}
          error={error}
          hasNextPage={hasNextPage}
          onLoadMore={loadMore}
          onCardClick={handleCardClick}
          onAddToLibrary={handleOpenLibraryModal}
          getLibraryEntry={(id) => findByGoogleBooksId(id)}
          isLibraryView={false}
          animationKey={gridKey}
          emptyMessage={
            activeTab === "search" && searchQuery.length < 2
              ? "Digite pelo menos 2 caracteres para buscar."
              : "Nenhum livro encontrado."
          }
        />
      )}

      {selectedBookId !== null && (
        <BookDrawer
          bookId={selectedBookId}
          onClose={() => setSelectedBookId(null)}
          onBookLoad={handleBookLoad}
          notes={drawerEntry?.notes}
          onNotesChange={
            drawerEntry ? (notes) => { void updateEntry(drawerEntry.id, { notes }); } : undefined
          }
        />
      )}

      {selectedBookForModal !== null && (() => {
        const modalEntry = findByGoogleBooksId(selectedBookForModal.id);
        const modalAuthorKey = modalEntry ? authorKey(modalEntry) : null;
        const canSetCover =
          !!modalEntry &&
          modalAuthorKey !== null &&
          libraryEntries.filter((e) => authorKey(e) === modalAuthorKey).length > 1;
        return (
          <BookLibraryModal
            book={selectedBookForModal}
            libraryEntry={modalEntry}
            onClose={() => setSelectedBookForModal(null)}
            onSave={handleModalSave}
            onRemove={handleModalRemove}
            onSetCover={(id) => {
              setCoverEntry(id);
              setSelectedBookForModal(null);
            }}
            canSetCover={canSetCover}
          />
        );
      })()}
    </div>
  );
}
