import { useState, useCallback, useMemo } from "react";
import { TabNav } from "../../components/TabNav/TabNav";
import { FranchiseGrid } from "../../components/FranchiseGrid/FranchiseGrid";
import { YoutubeDrawer } from "../../components/YoutubeDrawer/YoutubeDrawer";
import { YoutubeLibraryModal } from "../../components/YoutubeLibraryModal/YoutubeLibraryModal";
import { LibraryControls } from "../../components/LibraryControls/LibraryControls";
import { CollectionTagBar } from "../../components/CollectionTagBar/CollectionTagBar";
import { TagPickerModal } from "../../components/TagPickerModal/TagPickerModal";
import { YoutubeTagContext } from "../../context/youtubeTagContext";
import { youtubeCardConfig } from "../../config/cards";
import { useYoutubeLibrary } from "../../hooks/useYoutubeLibrary";
import { useYoutubeCollections } from "../../hooks/useYoutubeCollections";
import { useSingleSort } from "../../hooks/useSingleSort";
import type { YoutubeCard, YoutubeLibraryStatus } from "../../types/youtubeLibrary";
import { YOUTUBE_LIBRARY_STATUS_LABELS } from "../../types/youtubeLibrary";
import {
  buildYoutubeCollectionGroups,
  applyStatusView,
  videoDateOf,
  viewsOf,
  type YoutubeGroup,
} from "../../utils/youtubeCollectionGroups";
import { sortGroupsByName, sortGroupsByMemberDate, sortGroupsBySumViews } from "../../utils/sortGroups";
import { youtubeLibraryEntryToCard } from "../../utils/youtubeLibraryEntryToCard";
import { formatDurationLong } from "../../utils/formatDuration";
import { formatViews } from "../../utils/formatViews";
import styles from "./YouTubePage.module.css";

const STATUS_TABS = (Object.entries(YOUTUBE_LIBRARY_STATUS_LABELS) as [YoutubeLibraryStatus, string][]).map(
  ([id, label]) => ({ id, label })
);

function matchesSearch(group: YoutubeGroup, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return group.members.some(
    (m) => m.title.toLowerCase().includes(q) || (m.channelTitle ?? "").toLowerCase().includes(q)
  );
}

export function YouTubePage() {
  const [activeStatus, setActiveStatus] = useState<YoutubeLibraryStatus>("liked");
  const [search, setSearch] = useState("");
  const [collectionFilter, setCollectionFilter] = useState<(number | "none")[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addNotice, setAddNotice] = useState<string | null>(null);
  const [drawerVideoId, setDrawerVideoId] = useState<string | null>(null);
  const [modalVideoId, setModalVideoId] = useState<string | null>(null);
  const [bulkTag, setBulkTag] = useState<{ ids: string[]; collectionId: number } | null>(null);
  const sort = useSingleSort("alpha", "asc");

  const {
    entries,
    loading,
    error,
    update: updateEntry,
    updateMany: updateManyEntries,
    setCover: setCoverEntry,
    remove: removeEntry,
    removeMany: removeManyEntries,
    findByVideoId,
    addFromUrl,
    formGroup,
    addToGroup,
    removeFromGroup,
    setTagMany,
  } = useYoutubeLibrary();

  const collections = useYoutubeCollections();

  // Vocabulário de tags: sai do DISTINCT dentro de cada coleção, não de tabela.
  const tagsByCollection = useMemo(() => {
    const map = new Map<number, Set<string>>();
    for (const entry of entries) {
      if (entry.collectionId == null || !entry.tag) continue;
      const set = map.get(entry.collectionId) ?? new Set<string>();
      set.add(entry.tag);
      map.set(entry.collectionId, set);
    }
    return new Map(
      [...map].map(([id, set]) => [
        id,
        [...set].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" })),
      ])
    );
  }, [entries]);

  const tagContext = useMemo(
    () => ({
      tagsOf: (collectionId: number | null) =>
        collectionId == null ? [] : tagsByCollection.get(collectionId) ?? [],
      setTag: (entryId: string, tag: string | null) => {
        void updateEntry(entryId, { tag });
      },
    }),
    [tagsByCollection, updateEntry]
  );

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
        setAddNotice(`Playlist "${result.playlist.name}" adicionada — ${result.playlist.imported} vídeos`);
        collections.reload();
      }
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setAddError(msg ?? "Erro ao adicionar vídeo.");
    } finally {
      setAdding(false);
    }
  }, [urlInput, adding, addFromUrl, collections]);

  const handleCardClick = useCallback((card: YoutubeCard) => {
    setDrawerVideoId(card.id);
  }, []);

  const handleOpenModal = useCallback((card: YoutubeCard) => {
    setModalVideoId(card.id);
  }, []);

  const handleModalSave = useCallback(
    (id: string, data: { status: YoutubeLibraryStatus; score: number; isRewatching: boolean }) => {
      updateEntry(id, data);
      setModalVideoId(null);
    },
    [updateEntry]
  );

  const handleModalRemove = useCallback(
    (id: string) => {
      removeEntry(id).then(() => collections.reload());
      setModalVideoId(null);
    },
    [removeEntry, collections]
  );

  const toggleCollectionFilter = (value: number | "none") =>
    setCollectionFilter((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );

  let groups = buildYoutubeCollectionGroups(entries);
  if (collectionFilter.length > 0) {
    groups = groups.filter((g) => {
      const cid = g.representative.collectionId;
      return collectionFilter.some((f) => (f === "none" ? cid == null : cid === f));
    });
  }
  groups = applyStatusView(groups, activeStatus);
  groups = groups.filter((g) => matchesSearch(g, search));

  const nameOf = (g: YoutubeGroup) => {
    const cid = g.representative.collectionId;
    return cid != null ? collections.byId.get(cid) ?? "" : g.representative.title;
  };
  groups =
    sort.field === "views"
      ? sortGroupsBySumViews(groups, viewsOf, sort.dir)
      : sort.field === "date"
      ? sortGroupsByMemberDate(groups, videoDateOf, sort.dir)
      : sortGroupsByName(groups, nameOf, sort.dir);

  const gridKey = `${activeStatus}-${collectionFilter.join(",")}-${sort.field}-${sort.dir}-${search}`;

  const drawerEntry = drawerVideoId ? findByVideoId(drawerVideoId) : undefined;
  const modalEntry = modalVideoId ? findByVideoId(modalVideoId) : undefined;

  return (
    <div className={styles.page}>
      <h1 className={styles.srOnly}>YouTube</h1>

      <div className={styles.topRow}>
        <div className={styles.tabWrapper}>
          <TabNav plain tabs={STATUS_TABS} activeTab={activeStatus} onTabChange={(id) => setActiveStatus(id as YoutubeLibraryStatus)} />
        </div>
        <div className={styles.addBar}>
          <input
            className={styles.addInput}
            type="text"
            value={urlInput}
            placeholder="Cole o link de um vídeo ou playlist do YouTube..."
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
          />
          <button className={styles.addButton} onClick={handleAdd} disabled={adding || !urlInput.trim()}>
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
        filterGroups={
          collections.collections.length > 0
            ? [
                {
                  key: "collection",
                  title: "Coleção",
                  options: [
                    { value: "none", label: "Sem coleção" },
                    ...collections.collections.map((c) => ({ value: String(c.id), label: c.name })),
                  ],
                  selected: collectionFilter.map(String),
                  onToggle: (v) => toggleCollectionFilter(v === "none" ? "none" : Number(v)),
                },
              ]
            : []
        }
        onClearFilters={() => setCollectionFilter([])}
        sort={{
          active: sort.field,
          dir: sort.dir,
          options: [
            { field: "alpha", label: "Alfabética" },
            { field: "date", label: "Data" },
            { field: "views", label: "Visualizações" },
          ],
          onSelect: sort.select,
        }}
      />

      <YoutubeTagContext.Provider value={tagContext}>
        <FranchiseGrid
          groups={groups}
          loading={loading}
          error={error}
          cardConfig={youtubeCardConfig}
          entryToCard={youtubeLibraryEntryToCard}
          getExternalId={(e) => e.videoId}
          getLibraryEntry={(id) => findByVideoId(id)}
          onCardClick={handleCardClick}
          onAddToLibrary={handleOpenModal}
          onDeleteGroup={(group) => removeManyEntries(group.members.map((m) => m.id)).then(() => collections.reload())}
          statusLabels={YOUTUBE_LIBRARY_STATUS_LABELS}
          onBulkSetStatus={(ids, status) => updateManyEntries(ids, status)}
          expandTitle="Ver vídeos da coleção"
          animationKey={gridKey}
          gridClassName={styles.youtubeGrid}
          expansionClassName={styles.youtubeExpansion}
          emptyMessage="Nada por aqui ainda."
          emptyHint="Cole o link de um vídeo do YouTube para começar!"
          getCollectionKey={(e) => e.collectionId}
          onFormGroup={(ids, name) => formGroup(ids, name).then(() => collections.reload())}
          onAddToGroup={(ids, collectionId) => addToGroup(ids, collectionId).then(() => collections.reload())}
          onRemoveFromGroup={(ids) => removeFromGroup(ids).then(() => collections.reload())}
          onSetTag={(ids, collectionId) => setBulkTag({ ids, collectionId })}
          renderExpansion={(group, renderMembers) => (
            <CollectionTagBar group={group} renderMembers={renderMembers} />
          )}
          getCollectionName={(group) =>
            group.representative.collectionId != null
              ? collections.byId.get(group.representative.collectionId) ?? null
              : null
          }
          onRenameCollection={(group, name) => {
            if (group.representative.collectionId != null) collections.rename(group.representative.collectionId, name);
          }}
          getCollectionExtra={(group) => {
            const totalDuration = group.members.reduce((sum, v) => sum + (v.durationSeconds ?? 0), 0);
            const totalViews = group.members.reduce((sum, v) => sum + (v.viewCount ?? 0), 0);
            return (
              <div className={styles.collMeta}>
                {formatDurationLong(totalDuration)} · {formatViews(totalViews)}
              </div>
            );
          }}
        />
      </YoutubeTagContext.Provider>

      {drawerEntry && (
        <YoutubeDrawer
          entry={drawerEntry}
          onClose={() => setDrawerVideoId(null)}
          onNotesChange={(notes) => { void updateEntry(drawerEntry.id, { notes }); }}
        />
      )}

      {modalEntry && (
        <YoutubeLibraryModal
          entry={modalEntry}
          onClose={() => setModalVideoId(null)}
          onSave={handleModalSave}
          onRemove={handleModalRemove}
          onSetCover={(id) => {
            setCoverEntry(id);
            setModalVideoId(null);
          }}
        />
      )}

      {bulkTag && (
        <TagPickerModal
          count={bulkTag.ids.length}
          tags={tagsByCollection.get(bulkTag.collectionId) ?? []}
          onPick={(tag) => {
            void setTagMany(bulkTag.ids, tag);
            setBulkTag(null);
          }}
          onClose={() => setBulkTag(null)}
        />
      )}
    </div>
  );
}
