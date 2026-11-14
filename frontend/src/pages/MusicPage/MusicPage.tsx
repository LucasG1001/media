import { useState, useCallback, useMemo } from "react";
import { TabNav } from "../../components/TabNav/TabNav";
import { FranchiseGrid } from "../../components/FranchiseGrid/FranchiseGrid";
import { YoutubeDrawer } from "../../components/YoutubeDrawer/YoutubeDrawer";
import { YoutubeLibraryModal } from "../../components/YoutubeLibraryModal/YoutubeLibraryModal";
import { LibraryControls } from "../../components/LibraryControls/LibraryControls";
import { musicCardConfig } from "../../config/cards";
import { useMusicLibrary } from "../../hooks/useMusicLibrary";
import { useSingleSort } from "../../hooks/useSingleSort";
import type { MusicCard, MusicLibraryStatus } from "../../types/musicLibrary";
import { MUSIC_LIBRARY_STATUS_LABELS } from "../../types/musicLibrary";
import { visibleTracks, toMusicGroups, musicLibraryEntryToCard } from "../../utils/musicList";
import { collectionNav } from "../../utils/collectionNav";
import { useOnline } from "../../context/connectivityContext";
// Mesma moldura da página do YouTube (faixa de adicionar, grade 16:9): o CSS é
// compartilhado em vez de copiado.
import styles from "../YouTubePage/YouTubePage.module.css";

const STATUS_TABS = (Object.entries(MUSIC_LIBRARY_STATUS_LABELS) as [MusicLibraryStatus, string][]).map(
  ([id, label]) => ({ id, label })
);

export function MusicPage() {
  const online = useOnline();
  const [activeStatus, setActiveStatus] = useState<MusicLibraryStatus>("liked");
  const [search, setSearch] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addNotice, setAddNotice] = useState<string | null>(null);
  const [drawerVideoId, setDrawerVideoId] = useState<string | null>(null);
  const [modalVideoId, setModalVideoId] = useState<string | null>(null);
  const sort = useSingleSort("alpha", "asc");

  const {
    entries,
    loading,
    error,
    update: updateEntry,
    updateMany: updateManyEntries,
    remove: removeEntry,
    removeMany: removeManyEntries,
    findByVideoId,
    registerAccess,
    addFromUrl,
  } = useMusicLibrary();

  const handleAdd = useCallback(async () => {
    const url = urlInput.trim();
    if (!url || adding) return;
    setAdding(true);
    setAddError(null);
    setAddNotice(null);
    try {
      const result = await addFromUrl(url);
      setUrlInput("");
      if (result && "playlist" in result) {
        const { name, imported, total } = result.playlist;
        const skipped = total - imported;
        setAddNotice(
          `Playlist "${name}": ${imported} ${imported === 1 ? "música adicionada" : "músicas adicionadas"}` +
            (skipped > 0 ? ` (${skipped} já ${skipped === 1 ? "estava" : "estavam"} na biblioteca)` : "")
        );
      }
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setAddError(msg ?? "Erro ao adicionar música.");
    } finally {
      setAdding(false);
    }
  }, [urlInput, adding, addFromUrl]);

  const handleCardClick = useCallback((card: MusicCard) => {
    setDrawerVideoId(card.id);
  }, []);

  const handleOpenModal = useCallback((card: MusicCard) => {
    setModalVideoId(card.id);
  }, []);

  const tracks = useMemo(
    () => visibleTracks(entries, { status: activeStatus, search, sortField: sort.field, sortDir: sort.dir }),
    [entries, activeStatus, search, sort.field, sort.dir]
  );
  const groups = useMemo(() => toMusicGroups(tracks), [tracks]);

  const gridKey = `${activeStatus}-${sort.field}-${sort.dir}-${search}`;

  const drawerEntry = drawerVideoId ? findByVideoId(drawerVideoId) : undefined;
  const modalEntry = modalVideoId ? findByVideoId(modalVideoId) : undefined;

  // Sem coleção para delimitar a sequência, o anterior/próximo percorre a lista
  // que está na tela inteira — um pseudo-grupo com todas as músicas visíveis.
  const drawerNav = useMemo(() => {
    if (!drawerEntry) return null;
    return collectionNav([{ members: tracks }], (m) => m.id === drawerEntry.id);
  }, [drawerEntry, tracks]);

  return (
    <div className={styles.page}>
      <h1 className={styles.srOnly}>Música</h1>

      <div className={styles.topRow}>
        <div className={styles.tabWrapper}>
          <TabNav plain tabs={STATUS_TABS} activeTab={activeStatus} onTabChange={(id) => setActiveStatus(id as MusicLibraryStatus)} />
        </div>
        <div className={styles.addBar}>
          <input
            className={styles.addInput}
            type="text"
            value={urlInput}
            placeholder="Cole o link de uma música ou playlist do YouTube..."
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
          />
          <button
            className={styles.addButton}
            onClick={handleAdd}
            disabled={adding || !urlInput.trim() || !online}
            title={online ? undefined : "Sem conexão — adicionar música precisa de internet."}
          >
            {adding ? "Adicionando..." : "Adicionar"}
          </button>
        </div>
      </div>
      {addError && <div className={styles.addError}>{addError}</div>}
      {addNotice && <div className={styles.addNotice}>{addNotice}</div>}

      <LibraryControls
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por título ou canal..."
        count={groups.length}
        filterGroups={[]}
        onClearFilters={() => undefined}
        sort={{
          active: sort.field,
          dir: sort.dir,
          options: [
            { field: "alpha", label: "Alfabética" },
            { field: "date", label: "Data" },
            { field: "views", label: "Visualizações" },
            { field: "access", label: "Último acesso" },
          ],
          onSelect: sort.select,
        }}
      />

      <FranchiseGrid
        groups={groups}
        loading={loading}
        error={error}
        cardConfig={musicCardConfig}
        entryToCard={musicLibraryEntryToCard}
        getExternalId={(e) => e.videoId}
        getLibraryEntry={(id) => findByVideoId(id)}
        onCardClick={handleCardClick}
        onAddToLibrary={handleOpenModal}
        onDeleteGroup={(group) => removeManyEntries(group.members.map((m) => m.id))}
        statusLabels={MUSIC_LIBRARY_STATUS_LABELS}
        onBulkSetStatus={(ids, status) => updateManyEntries(ids, status)}
        expandTitle="Ver músicas"
        animationKey={gridKey}
        gridClassName={styles.youtubeGrid}
        emptyMessage="Nada por aqui ainda."
        emptyHint="Cole o link de uma música do YouTube para começar!"
      />

      {drawerEntry && (
        <YoutubeDrawer
          // Sem `key`, como no YouTube: remontar o drawer derrubaria a tela cheia
          // a cada música.
          entry={drawerEntry}
          onClose={() => setDrawerVideoId(null)}
          onOpen={() => { void registerAccess(drawerEntry.id); }}
          onNotesChange={(notes) => { void updateEntry(drawerEntry.id, { notes }); }}
          nav={
            drawerNav
              ? {
                  index: drawerNav.index,
                  total: drawerNav.total,
                  onPrev: drawerNav.prev ? () => setDrawerVideoId(drawerNav.prev!.videoId) : undefined,
                  onNext: drawerNav.next ? () => setDrawerVideoId(drawerNav.next!.videoId) : undefined,
                }
              : undefined
          }
        />
      )}

      {modalEntry && (
        <YoutubeLibraryModal
          entry={modalEntry}
          onClose={() => setModalVideoId(null)}
          onSave={(id, data) => {
            void updateEntry(id, data);
            setModalVideoId(null);
          }}
          onRemove={(id) => {
            void removeEntry(id);
            setModalVideoId(null);
          }}
        />
      )}
    </div>
  );
}
