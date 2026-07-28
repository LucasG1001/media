import { useState, useEffect, useCallback, useMemo } from "react";
import { TabNav } from "../../components/TabNav/TabNav";
import { MediaGrid } from "../../components/MediaGrid/MediaGrid";
import { FranchiseGrid } from "../../components/FranchiseGrid/FranchiseGrid";
import { seriesCardConfig, seasonCardConfig } from "../../config/cards";
import { SeriesDrawer } from "../../components/SeriesDrawer/SeriesDrawer";
import { SeriesLibraryModal } from "../../components/SeriesLibraryModal/SeriesLibraryModal";
import { SeasonDrawer } from "../../components/SeasonDrawer/SeasonDrawer";
import { SeasonLibraryModal } from "../../components/SeasonLibraryModal/SeasonLibraryModal";
import { SearchBar } from "../../components/SearchBar/SearchBar";
import { useSeries } from "../../hooks/useSeries";
import { useSeriesLibrary } from "../../hooks/useSeriesLibrary";
import { useDebounce } from "../../hooks/useDebounce";
import { useSingleSort } from "../../hooks/useSingleSort";
import { LibraryControls } from "../../components/LibraryControls/LibraryControls";
import type { SeriesCard, SeriesDetail } from "../../types/series";
import type { SeriesLibraryStatus, SeriesLibraryEntry } from "../../types/seriesLibrary";
import { SERIES_LIBRARY_STATUS_LABELS } from "../../types/seriesLibrary";
import { MONTH_PT } from "../../utils/month";
import { getCurrentYear, getRecentYears } from "../../utils/year";
import { buildSeasonGroups, seasonDateOf, type SeasonMember } from "../../utils/seasonGroups";
import { seriesLibraryEntryToCard } from "../../utils/seriesLibraryEntryToCard";
import { sortGroupsByAvgScore, sortGroupsByMemberDate } from "../../utils/sortGroups";
import { filterGroupsBySearch } from "../../utils/filterGroupsBySearch";
import styles from "./SeriesPage.module.css";

const TABS = [
  { id: "popular", label: "Mais Populares" },
  { id: "search", label: "Buscar" },
  { id: "library", label: "Minha Biblioteca" },
];

const STATUS_OPTIONS = Object.entries(SERIES_LIBRARY_STATUS_LABELS) as [SeriesLibraryStatus, string][];

export function SeriesPage() {
  const [activeTab, setActiveTab] = useState("popular");
  const [searchQuery, setSearchQuery] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
  const [selectedSeriesForModal, setSelectedSeriesForModal] = useState<SeriesCard | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<SeasonMember | null>(null);
  const [seasonModal, setSeasonModal] = useState<{ entry: SeriesLibraryEntry; member: SeasonMember } | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<SeriesLibraryStatus[]>([]);
  const sort = useSingleSort("release");
  const [selectedYear, setSelectedYear] = useState(getCurrentYear());
  const [selectedMonth, setSelectedMonth] = useState(0);
  const debouncedSearch = useDebounce(searchQuery, 400);

  const { series, loading, error, hasNextPage, loadPopular, search, loadMore, reset } = useSeries();
  const {
    entries: libraryEntries,
    loading: libraryLoading,
    error: libraryError,
    add: addEntry,
    update: updateEntry,
    remove: removeEntry,
    saveSeason,
    setCoverSeason,
    findByTmdbId,
  } = useSeriesLibrary();

  useEffect(() => {
    if (activeTab === "popular") {
      loadPopular(selectedYear, selectedMonth);
    }
  }, [activeTab, selectedYear, selectedMonth, loadPopular]);

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

  const handleCardClick = (item: SeriesCard) => {
    setSelectedSeriesId(item.id);
  };

  // Clique na imagem: temporada → drawer da temporada (dados da série + episódios).
  // A capa da coleção não abre drawer (expande — ver coverTogglesExpansion); só a
  // série sem temporadas, que é card simples, cai no drawer da série.
  const handleCollectionCardClick = useCallback((card: SeasonMember) => {
    if (card.kind === "season" && card.seasonNumber != null) {
      setSelectedSeason(card);
    } else {
      setSelectedSeriesId(card.tmdbId);
    }
  }, []);

  // Botão de status: temporada → modal da temporada (status/nota/reassistindo/capa);
  // série sem temporadas → modal da série (status/reassistindo/remover).
  const handleSeasonStatusClick = useCallback((card: SeasonMember) => {
    const entry = findByTmdbId(card.tmdbId);
    if (!entry) return;
    if (card.kind === "season" && card.seasonNumber != null) {
      setSeasonModal({ entry, member: card });
    } else {
      setSelectedSeriesForModal(seriesLibraryEntryToCard(entry));
    }
  }, [findByTmdbId]);

  const handleOpenLibraryModal = useCallback((item: SeriesCard) => {
    setSelectedSeriesForModal(item);
  }, []);

  const handleModalSave = useCallback((item: SeriesCard, data: { status: SeriesLibraryStatus; isRewatching: boolean }) => {
    const existing = findByTmdbId(item.id);
    if (existing) {
      updateEntry(existing.id, { status: data.status, isRewatching: data.isRewatching, seriesStatus: item.seriesStatus });
    } else {
      addEntry({
        tmdbId: item.id,
        title: item.title,
        posterImage: item.posterImage,
        firstAirDate: item.firstAirDate,
        seriesStatus: item.seriesStatus,
        status: data.status,
      });
    }
    setSelectedSeriesForModal(null);
  }, [findByTmdbId, updateEntry, addEntry]);

  const handleModalRemove = useCallback((id: string) => {
    removeEntry(id);
    setSelectedSeriesForModal(null);
  }, [removeEntry]);

  const handleSeriesLoad = useCallback((seriesDetail: SeriesDetail) => {
    const entry = findByTmdbId(seriesDetail.id);
    if (entry) {
      const needsUpdate =
        entry.seriesStatus !== seriesDetail.seriesStatus ||
        entry.seasons !== seriesDetail.seasons ||
        entry.episodes !== seriesDetail.episodes ||
        entry.firstAirDate !== seriesDetail.firstAirDate ||
        entry.title !== seriesDetail.title ||
        entry.posterImage !== seriesDetail.posterImage;

      if (needsUpdate) {
        updateEntry(entry.id, {
          title: seriesDetail.title,
          posterImage: seriesDetail.posterImage,
          seasons: seriesDetail.seasons,
          episodes: seriesDetail.episodes,
          firstAirDate: seriesDetail.firstAirDate,
          seriesStatus: seriesDetail.seriesStatus,
        });
      }
    }
  }, [findByTmdbId, updateEntry]);

  const toggleLibraryFilter = (status: SeriesLibraryStatus) =>
    setLibraryFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );

  // Filtro de status age POR TEMPORADA (como filmes): reduz a coleção às que
  // batem; sem filtro esconde só as séries 100% abandonadas.
  const collectionGroups = useMemo(() => {
    const hasFilter = libraryFilter.length > 0;
    const memberFilter = hasFilter
      ? (m: SeasonMember) =>
          libraryFilter.includes(m.status as SeriesLibraryStatus) ||
          (libraryFilter.includes("plan_to_watch") && m.isRewatching)
      : undefined;

    const { groups, lookup } = buildSeasonGroups(libraryEntries, memberFilter);
    let result = groups;
    if (!hasFilter) {
      result = result.filter((g) => g.members.some((m) => m.status !== "dropped"));
    }
    result = sort.field === "score"
      ? sortGroupsByAvgScore(result, sort.dir)
      : sortGroupsByMemberDate(result, seasonDateOf, sort.dir);
    result = filterGroupsBySearch(result, librarySearch);
    return { groups: result, lookup };
  }, [libraryEntries, libraryFilter, librarySearch, sort.field, sort.dir]);

  const displayLoading = activeTab === "library" ? libraryLoading : loading;
  const displayError = activeTab === "library" ? libraryError : error;
  const libraryCount = collectionGroups.groups.length;

  const gridKey =
    activeTab === "library"
      ? `library-${libraryFilter.join(",")}-${sort.field}-${sort.dir}-${librarySearch}`
      : activeTab === "search"
      ? `search-${debouncedSearch}`
      : `popular-${selectedYear}-${selectedMonth}`;

  return (
    <div className={styles.page}>
      <h1 className={styles.srOnly}>Séries</h1>

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
            placeholder="Buscar série..."
          />
        </div>
      )}

      {activeTab === "library" && (
        <LibraryControls
          searchValue={librarySearch}
          onSearchChange={setLibrarySearch}
          count={libraryCount}
          filterGroups={[
            {
              key: "status",
              title: "Status",
              options: STATUS_OPTIONS.map(([value, label]) => ({ value, label })),
              selected: libraryFilter,
              onToggle: (v) => toggleLibraryFilter(v as SeriesLibraryStatus),
            },
          ]}
          onClearFilters={() => setLibraryFilter([])}
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
          groups={collectionGroups.groups}
          loading={displayLoading}
          error={displayError}
          cardConfig={seasonCardConfig}
          entryToCard={(m) => m}
          getExternalId={(m) => m.id}
          getLibraryEntry={(id) => collectionGroups.lookup.get(id)}
          onCardClick={handleCollectionCardClick}
          onAddToLibrary={handleSeasonStatusClick}
          onDeleteGroup={(group) => {
            const entry = findByTmdbId(group.representative.tmdbId);
            if (entry) removeEntry(entry.id);
          }}
          getCollectionKey={(m) => (m.hasSeasons ? m.tmdbId : null)}
          expandTitle="Ver temporadas"
          coverTogglesExpansion
          animationKey={gridKey}
          emptyMessage="Sua biblioteca está vazia."
          emptyHint="Adicione séries para começar!"
        />
      ) : (
        <MediaGrid
          items={series}
          config={seriesCardConfig}
          loading={displayLoading}
          error={displayError}
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
              : "Nenhuma série encontrada."
          }
        />
      )}

      {selectedSeriesId !== null && (
        <SeriesDrawer
          seriesId={selectedSeriesId}
          onClose={() => setSelectedSeriesId(null)}
          onSeriesLoad={handleSeriesLoad}
        />
      )}

      {selectedSeriesForModal !== null && (
        <SeriesLibraryModal
          series={selectedSeriesForModal}
          libraryEntry={findByTmdbId(selectedSeriesForModal.id)}
          onClose={() => setSelectedSeriesForModal(null)}
          onSave={handleModalSave}
          onRemove={handleModalRemove}
        />
      )}

      {selectedSeason !== null && selectedSeason.seasonNumber != null && (
        <SeasonDrawer
          seriesId={selectedSeason.tmdbId}
          seasonNumber={selectedSeason.seasonNumber}
          onClose={() => setSelectedSeason(null)}
          onSeriesLoad={handleSeriesLoad}
        />
      )}

      {seasonModal !== null && seasonModal.member.seasonNumber != null && (
        <SeasonLibraryModal
          seriesTitle={seasonModal.entry.title}
          seasonNumber={seasonModal.member.seasonNumber}
          seasonName={seasonModal.member.title}
          poster={seasonModal.member.poster}
          status={seasonModal.member.status as SeriesLibraryStatus}
          score={seasonModal.member.score}
          isRewatching={seasonModal.member.isRewatching}
          isCover={findByTmdbId(seasonModal.member.tmdbId)?.coverSeason === seasonModal.member.seasonNumber}
          onClose={() => setSeasonModal(null)}
          onSave={(data) => {
            saveSeason(seasonModal.entry.id, seasonModal.member.seasonNumber as number, data);
            setSeasonModal(null);
          }}
          onSetCover={() => setCoverSeason(seasonModal.entry.id, seasonModal.member.seasonNumber as number)}
        />
      )}
    </div>
  );
}
