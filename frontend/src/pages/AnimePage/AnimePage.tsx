import { useState, useEffect, useCallback, useMemo } from "react";
import { TabNav } from "../../components/TabNav/TabNav";
import { MediaGrid } from "../../components/MediaGrid/MediaGrid";
import { FranchiseGrid } from "../../components/FranchiseGrid/FranchiseGrid";
import { AnimeDrawer } from "../../components/AnimeDrawer/AnimeDrawer";
import { LibraryModal } from "../../components/LibraryModal/LibraryModal";
import { SearchBar } from "../../components/SearchBar/SearchBar";
import { animeCardConfig } from "../../config/cards";
import { useAnime } from "../../hooks/useAnime";
import { useLibrary } from "../../hooks/useLibrary";
import { useDebounce } from "../../hooks/useDebounce";
import { useSingleSort } from "../../hooks/useSingleSort";
import { LibraryControls } from "../../components/LibraryControls/LibraryControls";
import type { AnimeCard } from "../../types/anime";
import type { AnimeDetail } from "../../types/anime";
import type { LibraryStatus, LibraryEntry } from "../../types/library";
import { LIBRARY_STATUS_LABELS } from "../../types/library";
import { SEASON_PT, getCurrentRealSeason, getSurroundingSeasons } from "../../utils/season";
import { getRecentYears } from "../../utils/year";
import { buildFranchiseGroups, seasonYearOf } from "../../utils/franchiseGroups";
import { libraryEntryToCard } from "../../utils/libraryEntryToCard";
import { filterGroupsBySearch } from "../../utils/filterGroupsBySearch";
import { sortGroupsByAvgScore, sortGroupsByMemberDate } from "../../utils/sortGroups";
import styles from "./AnimePage.module.css";

const TABS = [
  { id: "seasons", label: "Temporadas" },
  { id: "popular", label: "Mais Populares" },
  { id: "search", label: "Buscar" },
  { id: "library", label: "Minha Biblioteca" },
];

const STATUS_OPTIONS = Object.entries(LIBRARY_STATUS_LABELS) as [LibraryStatus, string][];

const AIRING_OPTIONS: [string, string][] = [
  ["RELEASING", "Em exibição"],
  ["FINISHED", "Finalizado"],
  ["NOT_YET_RELEASED", "Em breve"],
];

export function AnimePage() {
  const [activeTab, setActiveTab] = useState("seasons");
  const [searchQuery, setSearchQuery] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
  const [selectedAnimeId, setSelectedAnimeId] = useState<number | null>(null);
  const [selectedAnimeForModal, setSelectedAnimeForModal] = useState<AnimeCard | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<LibraryStatus[]>([]);
  const [airingFilter, setAiringFilter] = useState<string[]>([]);
  const sort = useSingleSort("release");
  const [selectedSeasonObj, setSelectedSeasonObj] = useState(getCurrentRealSeason());
  const [selectedPopularYear, setSelectedPopularYear] = useState(0);
  const debouncedSearch = useDebounce(searchQuery, 400);

  const { animes, loading, error, hasNextPage, loadSeason, loadPopular, search, loadMore, reset } = useAnime();
  const {
    entries: libraryEntries,
    loading: libraryLoading,
    error: libraryError,
    add: addEntry,
    update: updateEntry,
    updateMany: updateManyEntries,
    setCover: setCoverEntry,
    registerAccess,
    remove: removeEntry,
    removeMany: removeManyEntries,
    findByAnilistId,
  } = useLibrary();

  useEffect(() => {
    switch (activeTab) {
      case "seasons": loadSeason(selectedSeasonObj.season, selectedSeasonObj.year); break;
      case "popular": loadPopular(selectedPopularYear || undefined); break;
    }
  }, [activeTab, selectedSeasonObj, selectedPopularYear, loadSeason, loadPopular]);

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

  const handleCardClick = (anime: AnimeCard) => {
    setSelectedAnimeId(anime.id);
  };

  const handleOpenLibraryModal = useCallback((anime: AnimeCard) => {
    setSelectedAnimeForModal(anime);
  }, []);

  const handleModalSave = useCallback((anime: AnimeCard, data: { status: LibraryStatus; score: number }) => {
    const existing = findByAnilistId(anime.id);
    if (existing) {
      updateEntry(existing.id, { status: data.status, score: data.score, animeStatus: anime.status });
    } else {
      addEntry({
        anilistId: anime.id,
        title: anime.title,
        coverImage: anime.coverImage,
        totalEpisodes: anime.episodes ?? undefined,
        animeStatus: anime.status,
        seasonYear: anime.seasonYear,
        nextAiringEpisode: anime.nextAiringEpisode,
        streamingLinks: anime.streamingLinks,
        status: data.status,
        score: data.score,
      });
    }
    setSelectedAnimeForModal(null);
  }, [findByAnilistId, updateEntry, addEntry]);

  const handleModalRemove = useCallback((id: string) => {
    removeEntry(id);
    setSelectedAnimeForModal(null);
  }, [removeEntry]);

  const handleAnimeLoad = useCallback((animeDetail: AnimeDetail) => {
    const entry = findByAnilistId(animeDetail.id);
    if (entry) {
      const animeEpisodes = animeDetail.episodes ?? null;
      const needsUpdate =
        entry.animeStatus !== animeDetail.status ||
        entry.totalEpisodes !== animeEpisodes ||
        entry.title !== animeDetail.title ||
        entry.coverImage !== animeDetail.coverImage;

      if (needsUpdate) {
        updateEntry(entry.id, {
          title: animeDetail.title,
          coverImage: animeDetail.coverImage,
          totalEpisodes: animeEpisodes,
          animeStatus: animeDetail.status,
        });
      }
    }
  }, [findByAnilistId, updateEntry]);

  const toggleLibraryFilter = (status: LibraryStatus) =>
    setLibraryFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );

  const toggleAiringFilter = (status: string) =>
    setAiringFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );

  const franchiseGroups = useMemo(() => {
    const hasFilter = libraryFilter.length > 0 || airingFilter.length > 0;
    const memberFilter = hasFilter
      ? (m: LibraryEntry) =>
          (libraryFilter.length === 0 || libraryFilter.includes(m.status as LibraryStatus)) &&
          (airingFilter.length === 0 || (m.animeStatus != null && airingFilter.includes(m.animeStatus)))
      : undefined;
    let groups = buildFranchiseGroups(libraryEntries, memberFilter);
    if (!hasFilter) {
      groups = groups.filter((g) => g.members.some((m) => m.status !== "dropped"));
    }
    groups =
      sort.field === "score"
        ? sortGroupsByAvgScore(groups, sort.dir)
        : sortGroupsByMemberDate(groups, seasonYearOf, sort.dir);
    return filterGroupsBySearch(groups, librarySearch);
  }, [libraryEntries, libraryFilter, airingFilter, sort.field, sort.dir, librarySearch]);

  const gridKey =
    activeTab === "library"
      ? `library-${libraryFilter.join(",")}-${airingFilter.join(",")}-${sort.field}-${sort.dir}-${librarySearch}`
      : activeTab === "seasons"
      ? `seasons-${selectedSeasonObj.season}-${selectedSeasonObj.year}`
      : activeTab === "search"
      ? `search-${debouncedSearch}`
      : activeTab === "popular"
      ? `popular-${selectedPopularYear}`
      : activeTab;

  const drawerEntry = selectedAnimeId !== null ? findByAnilistId(selectedAnimeId) : undefined;

  return (
    <div className={styles.page}>
      <h1 className={styles.srOnly}>Anime</h1>

      <div className={styles.tabWrapper}>
        <TabNav tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      {activeTab === "seasons" && (
        <div className={styles.seasonSelectorWrapper}>
          <select
            className={styles.seasonSelect}
            value={`${selectedSeasonObj.season}-${selectedSeasonObj.year}`}
            onChange={(e) => {
              const [s, y] = e.target.value.split("-");
              setSelectedSeasonObj({ season: s, year: parseInt(y) });
            }}
          >
            {getSurroundingSeasons(selectedSeasonObj.season, selectedSeasonObj.year).map(s => (
              <option key={`${s.season}-${s.year}`} value={`${s.season}-${s.year}`}>
                {SEASON_PT[s.season]} {s.year}
              </option>
            ))}
          </select>
        </div>
      )}

      {activeTab === "popular" && (
        <div className={styles.seasonSelectorWrapper}>
          <select
            className={styles.seasonSelect}
            value={selectedPopularYear}
            onChange={(e) => setSelectedPopularYear(parseInt(e.target.value))}
          >
            <option value={0}>Todos os anos</option>
            {getRecentYears().map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      )}

      {activeTab === "search" && (
        <div className={styles.searchWrapper}>
          <SearchBar value={searchQuery} onChange={setSearchQuery} loading={loading && searchQuery.length > 0} />
        </div>
      )}

      {activeTab === "library" && (
        <LibraryControls
          searchValue={librarySearch}
          onSearchChange={setLibrarySearch}
          count={franchiseGroups.length}
          filterGroups={[
            {
              key: "status",
              title: "Status",
              options: STATUS_OPTIONS.map(([value, label]) => ({ value, label })),
              selected: libraryFilter,
              onToggle: (v) => toggleLibraryFilter(v as LibraryStatus),
            },
            {
              key: "airing",
              title: "Exibição",
              options: AIRING_OPTIONS.map(([value, label]) => ({ value, label })),
              selected: airingFilter,
              onToggle: toggleAiringFilter,
            },
          ]}
          onClearFilters={() => {
            setLibraryFilter([]);
            setAiringFilter([]);
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
          groups={franchiseGroups}
          loading={libraryLoading}
          error={libraryError}
          cardConfig={animeCardConfig}
          entryToCard={libraryEntryToCard}
          getExternalId={(e) => e.anilistId}
          onCardClick={handleCardClick}
          onAddToLibrary={handleOpenLibraryModal}
          getLibraryEntry={(id) => findByAnilistId(id)}
          onDeleteGroup={(group) => removeManyEntries(group.members.map((m) => m.id))}
          statusLabels={LIBRARY_STATUS_LABELS}
          onBulkSetStatus={(ids, status) => updateManyEntries(ids, status)}
          expandTitle="Ver temporadas, OVAs e filmes"
          coverIsCollectionOnly
          animationKey={gridKey}
          emptyMessage="Sua biblioteca está vazia."
          emptyHint="Adicione animes para começar!"
        />
      ) : (
        <MediaGrid
          items={animes}
          config={animeCardConfig}
          loading={loading}
          error={error}
          hasNextPage={hasNextPage}
          onLoadMore={loadMore}
          onCardClick={handleCardClick}
          onAddToLibrary={handleOpenLibraryModal}
          getLibraryEntry={(id) => findByAnilistId(id)}
          isLibraryView={false}
          animationKey={gridKey}
          emptyMessage={
            activeTab === "search" && searchQuery.length < 2
              ? "Digite pelo menos 2 caracteres para buscar."
              : "Nenhum anime encontrado."
          }
        />
      )}

      {selectedAnimeId !== null && (
        <AnimeDrawer
          animeId={selectedAnimeId}
          onClose={() => setSelectedAnimeId(null)}
          onAnimeLoad={handleAnimeLoad}
          notes={drawerEntry?.notes}
          onNotesChange={
            drawerEntry ? (notes) => { void updateEntry(drawerEntry.id, { notes }); } : undefined
          }
        />
      )}

      {selectedAnimeForModal !== null && (
        <LibraryModal
          anime={selectedAnimeForModal}
          libraryEntry={findByAnilistId(selectedAnimeForModal.id)}
          onClose={() => setSelectedAnimeForModal(null)}
          onSave={handleModalSave}
          onRemove={handleModalRemove}
          onSetCover={(id) => {
            setCoverEntry(id);
            setSelectedAnimeForModal(null);
          }}
          onAccessAgain={(id) => { void registerAccess(id); }}
        />
      )}
    </div>
  );
}
