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
import { SERIES_AIR_GROUP_LABELS, seriesAirGroup, type SeriesAirGroup } from "../../utils/seriesFormat";
import { sortGroupsByAvgScore, sortGroupsByMemberDate } from "../../utils/sortGroups";
import { lastAccessTimeOf } from "../../utils/lastAccess";
import { filterGroupsBySearch } from "../../utils/filterGroupsBySearch";
import styles from "./SeriesPage.module.css";

const TABS = [
  { id: "popular", label: "Mais Populares" },
  { id: "search", label: "Buscar" },
  { id: "library", label: "Minha Biblioteca" },
];

const STATUS_OPTIONS = Object.entries(SERIES_LIBRARY_STATUS_LABELS) as [SeriesLibraryStatus, string][];
const AIR_OPTIONS = Object.entries(SERIES_AIR_GROUP_LABELS) as [SeriesAirGroup, string][];

export function SeriesPage() {
  const [activeTab, setActiveTab] = useState("popular");
  const [searchQuery, setSearchQuery] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
  const [selectedSeriesForModal, setSelectedSeriesForModal] = useState<SeriesCard | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<SeasonMember | null>(null);
  const [seasonModal, setSeasonModal] = useState<{ entry: SeriesLibraryEntry; member: SeasonMember } | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<SeriesLibraryStatus[]>([]);
  const [airFilter, setAirFilter] = useState<SeriesAirGroup[]>([]);
  const [showLastAccess, setShowLastAccess] = useState(false);
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
    saveSeasonNotes,
    registerAccess,
    registerSeasonAccess,
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
  // A capa da coleção não abre drawer (expande — ver coverIsCollectionOnly); só a
  // série sem temporadas, que é card simples, cai no drawer da série.
  const handleCollectionCardClick = useCallback((card: SeasonMember) => {
    if (card.kind === "season" && card.seasonNumber != null) {
      setSelectedSeason(card);
    } else {
      setSelectedSeriesId(card.tmdbId);
    }
  }, []);

  // Botão de status: temporada → modal da temporada (status/nota/capa);
  // série sem temporadas → modal da série (status/remover).
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

  const handleModalSave = useCallback((item: SeriesCard, data: { status: SeriesLibraryStatus }) => {
    const existing = findByTmdbId(item.id);
    if (existing) {
      updateEntry(existing.id, { status: data.status, seriesStatus: item.seriesStatus });
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

  const toggleAirFilter = (group: SeriesAirGroup) =>
    setAirFilter((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );

  // Filtro de status age POR TEMPORADA (como filmes): reduz a coleção às que
  // batem; sem filtro esconde só as séries 100% abandonadas. Já o de exibição é
  // da SÉRIE (o TMDB não dá status de exibição por temporada), então recorta a
  // lista de entries antes de montar as coleções.
  const collectionGroups = useMemo(() => {
    const hasFilter = libraryFilter.length > 0 || airFilter.length > 0;
    const memberFilter = libraryFilter.length > 0
      ? (m: SeasonMember) => libraryFilter.includes(m.status as SeriesLibraryStatus)
      : undefined;

    const entries = airFilter.length > 0
      ? libraryEntries.filter((e) => airFilter.includes(seriesAirGroup(e.airStatus, e.seriesStatus)))
      : libraryEntries;

    const { groups, lookup } = buildSeasonGroups(entries, memberFilter);
    let result = groups;
    if (!hasFilter) {
      result = result.filter((g) => g.members.some((m) => m.status !== "dropped"));
    }
    result = sort.field === "access"
      ? sortGroupsByMemberDate(result, lastAccessTimeOf, sort.dir, "latest")
      : sort.field === "score"
      ? sortGroupsByAvgScore(result, sort.dir)
      : sortGroupsByMemberDate(result, seasonDateOf, sort.dir);
    result = filterGroupsBySearch(result, librarySearch);
    return { groups: result, lookup };
  }, [libraryEntries, libraryFilter, airFilter, librarySearch, sort.field, sort.dir]);

  const displayLoading = activeTab === "library" ? libraryLoading : loading;
  const displayError = activeTab === "library" ? libraryError : error;
  const libraryCount = collectionGroups.groups.length;

  const gridKey =
    activeTab === "library"
      ? `library-${libraryFilter.join(",")}-${airFilter.join(",")}-${sort.field}-${sort.dir}-${librarySearch}`
      : activeTab === "search"
      ? `search-${debouncedSearch}`
      : `popular-${selectedYear}-${selectedMonth}`;

  const seasonDrawerEntry = selectedSeason ? findByTmdbId(selectedSeason.tmdbId) : undefined;
  const seasonDrawerNumber = selectedSeason?.seasonNumber ?? null;

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
            {
              key: "air",
              title: "Exibição",
              options: AIR_OPTIONS.map(([value, label]) => ({ value, label })),
              selected: airFilter,
              onToggle: (v) => toggleAirFilter(v as SeriesAirGroup),
            },
          ]}
          onClearFilters={() => {
            setLibraryFilter([]);
            setAirFilter([]);
          }}
          sort={{
            active: sort.field,
            dir: sort.dir,
            options: [
              { field: "release", label: "Lançamento" },
              { field: "score", label: "Nota" },
              { field: "access", label: "Último acesso" },
            ],
            onSelect: sort.select,
          }}
          toggle={{
            label: "Último acesso",
            active: showLastAccess,
            onToggle: () => setShowLastAccess((v) => !v),
            title: "Mostrar quando foi o último acesso em cada card",
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
          expandTitle="Ver temporadas"
          coverIsCollectionOnly
          showLastAccess={showLastAccess}
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
          onAccessAgain={(id) => { void registerAccess(id); }}
        />
      )}

      {selectedSeason !== null && seasonDrawerNumber != null && (
        <SeasonDrawer
          seriesId={selectedSeason.tmdbId}
          seasonNumber={seasonDrawerNumber}
          onClose={() => setSelectedSeason(null)}
          onSeriesLoad={handleSeriesLoad}
          notes={selectedSeason.notes}
          onNotesChange={
            seasonDrawerEntry
              ? (notes) => { void saveSeasonNotes(seasonDrawerEntry.id, seasonDrawerNumber, notes); }
              : undefined
          }
        />
      )}

      {seasonModal !== null && seasonModal.member.seasonNumber != null && (
        <SeasonLibraryModal
          seriesTitle={seasonModal.entry.title}
          seasonNumber={seasonModal.member.seasonNumber}
          seasonName={seasonModal.member.isOnlySeason ? null : seasonModal.member.title}
          poster={seasonModal.member.poster}
          status={seasonModal.member.status as SeriesLibraryStatus}
          score={seasonModal.member.score}
          lastAccessAt={seasonModal.member.lastAccessAt}
          isCover={findByTmdbId(seasonModal.member.tmdbId)?.coverSeason === seasonModal.member.seasonNumber}
          onClose={() => setSeasonModal(null)}
          onSave={(data) => {
            saveSeason(seasonModal.entry.id, seasonModal.member.seasonNumber as number, data);
            setSeasonModal(null);
          }}
          onAccessAgain={() => {
            void registerSeasonAccess(seasonModal.entry.id, seasonModal.member.seasonNumber as number);
          }}
          onSetCover={
            seasonModal.member.isOnlySeason
              ? undefined
              : () => setCoverSeason(seasonModal.entry.id, seasonModal.member.seasonNumber as number)
          }
          onRemove={
            seasonModal.member.isOnlySeason
              ? () => {
                  removeEntry(seasonModal.entry.id);
                  setSeasonModal(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
