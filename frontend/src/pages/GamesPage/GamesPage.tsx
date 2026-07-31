import { useState, useEffect, useCallback, useMemo } from "react";
import { TabNav } from "../../components/TabNav/TabNav";
import { MediaGrid } from "../../components/MediaGrid/MediaGrid";
import { FranchiseGrid } from "../../components/FranchiseGrid/FranchiseGrid";
import { GameDrawer } from "../../components/GameDrawer/GameDrawer";
import { GameLibraryModal } from "../../components/GameLibraryModal/GameLibraryModal";
import { SearchBar } from "../../components/SearchBar/SearchBar";
import { gameCardConfig } from "../../config/cards";
import { useGames } from "../../hooks/useGames";
import { useGameLibrary } from "../../hooks/useGameLibrary";
import { useDebounce } from "../../hooks/useDebounce";
import { useSingleSort } from "../../hooks/useSingleSort";
import { LibraryControls } from "../../components/LibraryControls/LibraryControls";
import type { GameCard, GameDetail } from "../../types/game";
import type { GameLibraryStatus, GameLibraryEntry, GameMode } from "../../types/gameLibrary";
import { GAME_LIBRARY_STATUS_LABELS, GAME_MODE_LABELS } from "../../types/gameLibrary";
import { MONTH_PT } from "../../utils/month";
import { getCurrentYear, getRecentYears } from "../../utils/year";
import { buildGameCollectionGroups, releaseTimeOf } from "../../utils/gameCollectionGroups";
import { gameLibraryEntryToCard } from "../../utils/gameLibraryEntryToCard";
import { filterGroupsBySearch } from "../../utils/filterGroupsBySearch";
import { sortGroupsByAvgScore, sortGroupsByMemberDate } from "../../utils/sortGroups";
import styles from "./GamesPage.module.css";

const TABS = [
  { id: "popular", label: "Mais Populares" },
  { id: "upcoming", label: "Em Breve" },
  { id: "search", label: "Buscar" },
  { id: "library", label: "Minha Biblioteca" },
];

const STATUS_OPTIONS = Object.entries(GAME_LIBRARY_STATUS_LABELS) as [GameLibraryStatus, string][];
const MODE_OPTIONS = Object.entries(GAME_MODE_LABELS) as [GameMode, string][];

const RELEASE_OPTIONS: [string, string][] = [
  ["RELEASED", "Lançado"],
  ["UPCOMING", "Em breve"],
];

export function GamesPage() {
  const [activeTab, setActiveTab] = useState("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [selectedGameForModal, setSelectedGameForModal] = useState<GameCard | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<GameLibraryStatus[]>([]);
  const [modeFilter, setModeFilter] = useState<GameMode[]>([]);
  const [releaseFilter, setReleaseFilter] = useState<string[]>([]);
  const sort = useSingleSort("release");
  const [selectedYear, setSelectedYear] = useState(getCurrentYear());
  const [selectedMonth, setSelectedMonth] = useState(0);
  const debouncedSearch = useDebounce(searchQuery, 400);

  const { games, loading, error, hasNextPage, loadPopular, loadUpcoming, search, loadMore, reset } = useGames();
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
    findByIgdbId,
  } = useGameLibrary();

  useEffect(() => {
    switch (activeTab) {
      case "popular": loadPopular(selectedYear, selectedMonth); break;
      case "upcoming": loadUpcoming(); break;
    }
  }, [activeTab, selectedYear, selectedMonth, loadPopular, loadUpcoming]);

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

  const handleCardClick = (game: GameCard) => {
    setSelectedGameId(game.id);
  };

  const handleOpenLibraryModal = useCallback((game: GameCard) => {
    setSelectedGameForModal(game);
  }, []);

  const handleModalSave = useCallback((game: GameCard, data: { status: GameLibraryStatus; score: number }) => {
    const existing = findByIgdbId(game.id);
    if (existing) {
      updateEntry(existing.id, { status: data.status, score: data.score, gameStatus: game.gameStatus });
    } else {
      addEntry({
        igdbId: game.id,
        title: game.title,
        backgroundImage: game.backgroundImage,
        released: game.released,
        metacritic: game.metacritic,
        gameStatus: game.gameStatus,
        status: data.status,
        score: data.score,
      });
    }
    setSelectedGameForModal(null);
  }, [findByIgdbId, updateEntry, addEntry]);

  const handleModalRemove = useCallback((id: string) => {
    removeEntry(id);
    setSelectedGameForModal(null);
  }, [removeEntry]);

  const handleGameLoad = useCallback((gameDetail: GameDetail) => {
    const entry = findByIgdbId(gameDetail.id);
    if (entry) {
      const needsUpdate =
        entry.gameStatus !== gameDetail.gameStatus ||
        entry.metacritic !== gameDetail.metacritic ||
        entry.released !== gameDetail.released ||
        entry.title !== gameDetail.title ||
        entry.backgroundImage !== gameDetail.backgroundImage;

      if (needsUpdate) {
        updateEntry(entry.id, {
          title: gameDetail.title,
          backgroundImage: gameDetail.backgroundImage,
          released: gameDetail.released,
          metacritic: gameDetail.metacritic,
          gameStatus: gameDetail.gameStatus,
        });
      }
    }
  }, [findByIgdbId, updateEntry]);

  const toggleLibraryFilter = (status: GameLibraryStatus) =>
    setLibraryFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );

  const toggleModeFilter = (mode: GameMode) =>
    setModeFilter((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    );

  const toggleReleaseFilter = (value: string) =>
    setReleaseFilter((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );

  const collectionGroups = useMemo(() => {
    const hasFilter = libraryFilter.length > 0 || modeFilter.length > 0 || releaseFilter.length > 0;
    // Multi-seleção: OU dentro de cada grupo, E entre status, lançamento e modos.
    const memberFilter = hasFilter
      ? (m: GameLibraryEntry) => {
          const statusOk = libraryFilter.length === 0 || libraryFilter.includes(m.status as GameLibraryStatus);
          const releaseOk = releaseFilter.length === 0 || releaseFilter.includes(m.gameStatus);
          const modeOk =
            modeFilter.length === 0 ||
            (m.gameModes?.some((mode) => modeFilter.includes(mode as GameMode)) ?? false);
          return statusOk && releaseOk && modeOk;
        }
      : undefined;
    let groups = buildGameCollectionGroups(libraryEntries, memberFilter);
    if (!hasFilter) {
      groups = groups.filter((g) => g.members.some((m) => m.status !== "dropped"));
    }
    groups =
      sort.field === "score"
        ? sortGroupsByAvgScore(groups, sort.dir)
        : sortGroupsByMemberDate(groups, releaseTimeOf, sort.dir);
    return filterGroupsBySearch(groups, librarySearch);
  }, [libraryEntries, libraryFilter, modeFilter, releaseFilter, sort.field, sort.dir, librarySearch]);

  const gridKey =
    activeTab === "library"
      ? `library-${libraryFilter.join(",")}-${modeFilter.join(",")}-${releaseFilter.join(",")}-${sort.field}-${sort.dir}-${librarySearch}`
      : activeTab === "search"
      ? `search-${debouncedSearch}`
      : activeTab === "popular"
      ? `popular-${selectedYear}-${selectedMonth}`
      : activeTab;

  const drawerEntry = selectedGameId !== null ? findByIgdbId(selectedGameId) : undefined;

  return (
    <div className={styles.page}>
      <h1 className={styles.srOnly}>Jogos</h1>

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
            placeholder="Buscar jogo..."
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
              onToggle: (v) => toggleLibraryFilter(v as GameLibraryStatus),
            },
            {
              key: "release",
              title: "Lançamento",
              options: RELEASE_OPTIONS.map(([value, label]) => ({ value, label })),
              selected: releaseFilter,
              onToggle: toggleReleaseFilter,
            },
            {
              key: "gameModes",
              title: "Modos de jogo",
              options: MODE_OPTIONS.map(([value, label]) => ({ value, label })),
              selected: modeFilter,
              onToggle: (v) => toggleModeFilter(v as GameMode),
            },
          ]}
          onClearFilters={() => {
            setLibraryFilter([]);
            setModeFilter([]);
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
          cardConfig={gameCardConfig}
          entryToCard={gameLibraryEntryToCard}
          getExternalId={(e) => e.igdbId}
          onCardClick={handleCardClick}
          onAddToLibrary={handleOpenLibraryModal}
          getLibraryEntry={(id) => findByIgdbId(id)}
          onDeleteGroup={(group) => removeManyEntries(group.members.map((m) => m.id))}
          statusLabels={GAME_LIBRARY_STATUS_LABELS}
          onBulkSetStatus={(ids, status) => updateManyEntries(ids, status)}
          expandTitle="Ver jogos da coleção"
          coverIsCollectionOnly
          animationKey={gridKey}
          emptyMessage="Sua biblioteca está vazia."
          emptyHint="Adicione jogos para começar!"
        />
      ) : (
        <MediaGrid
          items={games}
          config={gameCardConfig}
          loading={loading}
          error={error}
          hasNextPage={hasNextPage}
          onLoadMore={loadMore}
          onCardClick={handleCardClick}
          onAddToLibrary={handleOpenLibraryModal}
          getLibraryEntry={(id) => findByIgdbId(id)}
          isLibraryView={false}
          animationKey={gridKey}
          emptyMessage={
            activeTab === "search" && searchQuery.length < 2
              ? "Digite pelo menos 2 caracteres para buscar."
              : "Nenhum jogo encontrado."
          }
        />
      )}

      {selectedGameId !== null && (
        <GameDrawer
          gameId={selectedGameId}
          onClose={() => setSelectedGameId(null)}
          onGameLoad={handleGameLoad}
          notes={drawerEntry?.notes}
          onNotesChange={
            drawerEntry ? (notes) => { void updateEntry(drawerEntry.id, { notes }); } : undefined
          }
        />
      )}

      {selectedGameForModal !== null && (
        <GameLibraryModal
          game={selectedGameForModal}
          libraryEntry={findByIgdbId(selectedGameForModal.id)}
          onClose={() => setSelectedGameForModal(null)}
          onSave={handleModalSave}
          onRemove={handleModalRemove}
          onSetCover={(id) => {
            setCoverEntry(id);
            setSelectedGameForModal(null);
          }}
          onAccessAgain={(id) => { void registerAccess(id); }}
        />
      )}
    </div>
  );
}
