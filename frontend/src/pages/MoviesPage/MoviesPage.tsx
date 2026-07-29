import { useState, useEffect, useCallback, useMemo } from "react";
import { TabNav } from "../../components/TabNav/TabNav";
import { MediaGrid } from "../../components/MediaGrid/MediaGrid";
import { FranchiseGrid } from "../../components/FranchiseGrid/FranchiseGrid";
import { MovieDrawer } from "../../components/MovieDrawer/MovieDrawer";
import { MovieLibraryModal } from "../../components/MovieLibraryModal/MovieLibraryModal";
import { SearchBar } from "../../components/SearchBar/SearchBar";
import { movieCardConfig } from "../../config/cards";
import { useMovies } from "../../hooks/useMovies";
import { useMovieLibrary } from "../../hooks/useMovieLibrary";
import { useDebounce } from "../../hooks/useDebounce";
import { useSingleSort } from "../../hooks/useSingleSort";
import { LibraryControls } from "../../components/LibraryControls/LibraryControls";
import type { MovieCard, MovieDetail } from "../../types/movie";
import type { MovieLibraryStatus, MovieLibraryEntry } from "../../types/movieLibrary";
import { MOVIE_LIBRARY_STATUS_LABELS } from "../../types/movieLibrary";
import { MONTH_PT } from "../../utils/month";
import { getCurrentYear, getRecentYears } from "../../utils/year";
import { buildMovieCollectionGroups, releaseTimeOf } from "../../utils/movieCollectionGroups";
import { movieLibraryEntryToCard } from "../../utils/movieLibraryEntryToCard";
import { filterGroupsBySearch } from "../../utils/filterGroupsBySearch";
import { sortGroupsByAvgScore, sortGroupsByMemberDate } from "../../utils/sortGroups";
import styles from "./MoviesPage.module.css";

const TABS = [
  { id: "popular", label: "Mais Populares" },
  { id: "now_playing", label: "Em Cartaz" },
  { id: "search", label: "Buscar" },
  { id: "library", label: "Minha Biblioteca" },
];

const STATUS_OPTIONS = Object.entries(MOVIE_LIBRARY_STATUS_LABELS) as [MovieLibraryStatus, string][];

const RELEASE_OPTIONS: [string, string][] = [
  ["RELEASED", "Lançado"],
  ["UPCOMING", "Em breve"],
];

export function MoviesPage() {
  const [activeTab, setActiveTab] = useState("now_playing");
  const [searchQuery, setSearchQuery] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
  const [selectedMovieForModal, setSelectedMovieForModal] = useState<MovieCard | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<MovieLibraryStatus[]>([]);
  const [releaseFilter, setReleaseFilter] = useState<string[]>([]);
  const sort = useSingleSort("release");
  const [selectedYear, setSelectedYear] = useState(getCurrentYear());
  const [selectedMonth, setSelectedMonth] = useState(0);
  const debouncedSearch = useDebounce(searchQuery, 400);

  const { movies, loading, error, hasNextPage, loadPopular, loadNowPlaying, search, loadMore, reset } = useMovies();
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
    findByTmdbId,
  } = useMovieLibrary();

  useEffect(() => {
    switch (activeTab) {
      case "popular": loadPopular(selectedYear, selectedMonth); break;
      case "now_playing": loadNowPlaying(); break;
    }
  }, [activeTab, selectedYear, selectedMonth, loadPopular, loadNowPlaying]);

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

  const handleCardClick = (movie: MovieCard) => {
    setSelectedMovieId(movie.id);
  };

  const handleOpenLibraryModal = useCallback((movie: MovieCard) => {
    setSelectedMovieForModal(movie);
  }, []);

  const handleModalSave = useCallback((movie: MovieCard, data: { status: MovieLibraryStatus; score: number; isRewatching: boolean }) => {
    const existing = findByTmdbId(movie.id);
    if (existing) {
      updateEntry(existing.id, { status: data.status, score: data.score, isRewatching: data.isRewatching, movieStatus: movie.movieStatus });
    } else {
      addEntry({
        tmdbId: movie.id,
        title: movie.title,
        posterImage: movie.posterImage,
        releaseDate: movie.releaseDate,
        movieStatus: movie.movieStatus,
        status: data.status,
        score: data.score,
      });
    }
    setSelectedMovieForModal(null);
  }, [findByTmdbId, updateEntry, addEntry]);

  const handleModalRemove = useCallback((id: string) => {
    removeEntry(id);
    setSelectedMovieForModal(null);
  }, [removeEntry]);

  const handleMovieLoad = useCallback((movieDetail: MovieDetail) => {
    const entry = findByTmdbId(movieDetail.id);
    if (entry) {
      const needsUpdate =
        entry.movieStatus !== movieDetail.movieStatus ||
        entry.runtime !== movieDetail.runtime ||
        entry.releaseDate !== movieDetail.releaseDate ||
        entry.title !== movieDetail.title ||
        entry.posterImage !== movieDetail.posterImage;

      if (needsUpdate) {
        updateEntry(entry.id, {
          title: movieDetail.title,
          posterImage: movieDetail.posterImage,
          runtime: movieDetail.runtime,
          releaseDate: movieDetail.releaseDate,
          movieStatus: movieDetail.movieStatus,
        });
      }
    }
  }, [findByTmdbId, updateEntry]);

  const toggleLibraryFilter = (status: MovieLibraryStatus) =>
    setLibraryFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );

  const toggleReleaseFilter = (value: string) =>
    setReleaseFilter((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );

  const collectionGroups = useMemo(() => {
    const hasFilter = libraryFilter.length > 0 || releaseFilter.length > 0;
    // Multi-seleção: OU dentro de cada grupo, E entre status e lançamento.
    const memberFilter = hasFilter
      ? (m: MovieLibraryEntry) => {
          const statusOk =
            libraryFilter.length === 0 ||
            libraryFilter.includes(m.status as MovieLibraryStatus) ||
            (libraryFilter.includes("plan_to_watch") && m.isRewatching);
          const releaseOk = releaseFilter.length === 0 || releaseFilter.includes(m.movieStatus);
          return statusOk && releaseOk;
        }
      : undefined;
    let groups = buildMovieCollectionGroups(libraryEntries, memberFilter);
    if (!hasFilter) {
      groups = groups.filter((g) => g.members.some((m) => m.status !== "dropped"));
    }
    groups =
      sort.field === "score"
        ? sortGroupsByAvgScore(groups, sort.dir)
        : sortGroupsByMemberDate(groups, releaseTimeOf, sort.dir);
    return filterGroupsBySearch(groups, librarySearch);
  }, [libraryEntries, libraryFilter, releaseFilter, sort.field, sort.dir, librarySearch]);

  const gridKey =
    activeTab === "library"
      ? `library-${libraryFilter.join(",")}-${releaseFilter.join(",")}-${sort.field}-${sort.dir}-${librarySearch}`
      : activeTab === "search"
      ? `search-${debouncedSearch}`
      : activeTab === "popular"
      ? `popular-${selectedYear}-${selectedMonth}`
      : activeTab;

  const drawerEntry = selectedMovieId !== null ? findByTmdbId(selectedMovieId) : undefined;

  return (
    <div className={styles.page}>
      <h1 className={styles.srOnly}>Filmes</h1>

      <div className={styles.tabWrapper}>
        <TabNav tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      {activeTab === "popular" && (
        <div className={styles.selectorWrapper}>
          <select
            className={styles.filterSelect}
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            {getRecentYears().map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            className={styles.filterSelect}
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          >
            <option value={0}>Ano inteiro</option>
            {MONTH_PT.map((name, i) => (
              <option key={i + 1} value={i + 1}>
                {name}
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
            placeholder="Buscar filme..."
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
              onToggle: (v) => toggleLibraryFilter(v as MovieLibraryStatus),
            },
            {
              key: "release",
              title: "Lançamento",
              options: RELEASE_OPTIONS.map(([value, label]) => ({ value, label })),
              selected: releaseFilter,
              onToggle: toggleReleaseFilter,
            },
          ]}
          onClearFilters={() => {
            setLibraryFilter([]);
            setReleaseFilter([]);
          }}
          sort={{
            active: sort.field,
            dir: sort.dir,
            options: [
              { field: "release", label: "Lançamento" },
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
          cardConfig={movieCardConfig}
          entryToCard={movieLibraryEntryToCard}
          getExternalId={(e) => e.tmdbId}
          onCardClick={handleCardClick}
          onAddToLibrary={handleOpenLibraryModal}
          getLibraryEntry={(id) => findByTmdbId(id)}
          onDeleteGroup={(group) => removeManyEntries(group.members.map((m) => m.id))}
          statusLabels={MOVIE_LIBRARY_STATUS_LABELS}
          onBulkSetStatus={(ids, status) => updateManyEntries(ids, status)}
          expandTitle="Ver filmes da coleção"
          coverIsCollectionOnly
          animationKey={gridKey}
          emptyMessage="Sua biblioteca está vazia."
          emptyHint="Adicione filmes para começar!"
        />
      ) : (
        <MediaGrid
          items={movies}
          config={movieCardConfig}
          loading={loading}
          error={error}
          hasNextPage={hasNextPage}
          onLoadMore={loadMore}
          onCardClick={handleCardClick}
          onAddToLibrary={handleOpenLibraryModal}
          getLibraryEntry={(id) => findByTmdbId(id)}
          isLibraryView={false}
          animationKey={gridKey}
          emptyMessage={
            activeTab === "search" && searchQuery.length < 2
              ? "Digite pelo menos 2 caracteres para buscar."
              : "Nenhum filme encontrado."
          }
        />
      )}

      {selectedMovieId !== null && (
        <MovieDrawer
          movieId={selectedMovieId}
          onClose={() => setSelectedMovieId(null)}
          onMovieLoad={handleMovieLoad}
          notes={drawerEntry?.notes}
          onNotesChange={
            drawerEntry ? (notes) => { void updateEntry(drawerEntry.id, { notes }); } : undefined
          }
        />
      )}

      {selectedMovieForModal !== null && (
        <MovieLibraryModal
          movie={selectedMovieForModal}
          libraryEntry={findByTmdbId(selectedMovieForModal.id)}
          onClose={() => setSelectedMovieForModal(null)}
          onSave={handleModalSave}
          onRemove={handleModalRemove}
          onSetCover={(id) => {
            setCoverEntry(id);
            setSelectedMovieForModal(null);
          }}
        />
      )}
    </div>
  );
}
