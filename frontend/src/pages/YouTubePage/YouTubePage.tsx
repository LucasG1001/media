import { useState, useCallback, useMemo, type ReactNode } from "react";
import { TabNav } from "../../components/TabNav/TabNav";
import { FranchiseGrid } from "../../components/FranchiseGrid/FranchiseGrid";
import { YoutubeDrawer } from "../../components/YoutubeDrawer/YoutubeDrawer";
import { YoutubeLibraryModal } from "../../components/YoutubeLibraryModal/YoutubeLibraryModal";
import { LibraryControls } from "../../components/LibraryControls/LibraryControls";
import { TagBulkModal, type TagBulkMode } from "../../components/TagBulkModal/TagBulkModal";
import { TagSuggestionRow } from "../../components/TagFilterBar/TagSuggestionRow";
import { SelectedTagRow } from "../../components/TagFilterBar/SelectedTagRow";
import { YoutubeTagContext } from "../../context/youtubeTagContext";
import { youtubeCardConfig } from "../../config/cards";
import { useYoutubeLibrary } from "../../hooks/useYoutubeLibrary";
import { useYoutubeCollections } from "../../hooks/useYoutubeCollections";
import { useSingleSort } from "../../hooks/useSingleSort";
import type { YoutubeCard, YoutubeLibraryEntry, YoutubeLibraryStatus } from "../../types/youtubeLibrary";
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

const COLLATOR_OPTS = { sensitivity: "base" } as const;

// Quantas tags cada faixa sugere: a do filtro da expansão e a do menu do card.
const FILTER_SUGGESTION_LIMIT = 10;
const CARD_SUGGESTION_LIMIT = 4;

function byName(a: string, b: string): number {
  return a.localeCompare(b, "pt-BR", COLLATOR_OPTS);
}

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
  // Filtro de tag por coleção, chaveado pelo `group.key`: o FranchiseGrid é dono do
  // `expandedKey`, então guardar por chave evita ter que espelhar esse estado aqui
  // — e reabrir a coleção devolve o filtro onde estava.
  const [tagFilter, setTagFilter] = useState<Record<string, string[]>>({});
  const [urlInput, setUrlInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addNotice, setAddNotice] = useState<string | null>(null);
  const [drawerVideoId, setDrawerVideoId] = useState<string | null>(null);
  const [modalVideoId, setModalVideoId] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ mode: TagBulkMode; ids: string[] } | null>(null);
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
    registerAccess,
    addFromUrl,
    addTagMany,
    removeTagMany,
    formGroup,
    addToGroup,
    removeFromGroup,
  } = useYoutubeLibrary();

  const collections = useYoutubeCollections();

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
        setAddNotice(
          `Playlist "${result.playlist.name}" adicionada — ${result.playlist.imported} vídeos na coleção "${result.playlist.name}"`
        );
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

  const toggleCollectionFilter = (value: number | "none") =>
    setCollectionFilter((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );

  // Tudo que é tag é contado por coleção: a mesma palavra em duas coleções são
  // dois vocabulários independentes.
  const byCollection = useMemo(() => {
    const map = new Map<number, YoutubeLibraryEntry[]>();
    for (const entry of entries) {
      if (entry.collectionId == null) continue;
      const list = map.get(entry.collectionId);
      if (list) list.push(entry);
      else map.set(entry.collectionId, [entry]);
    }
    return map;
  }, [entries]);

  const tagContext = useMemo(() => {
    const countTags = (members: YoutubeLibraryEntry[]) => {
      const counts = new Map<string, number>();
      for (const entry of members) for (const tag of entry.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      return counts;
    };

    return {
      // Ordem alfabética: com muitas tags é o que dá para varrer no menu.
      allTagsFor: (collectionId: number) =>
        [...countTags(byCollection.get(collectionId) ?? []).keys()].sort(byName),
      // Ranking de popularidade da coleção, com desempate alfabético — é o que
      // ordena os chips dentro do card, então o corte de 2 linhas sempre esconde
      // a tag menos relevante.
      rankFor: (collectionId: number) => {
        const ordered = [...countTags(byCollection.get(collectionId) ?? []).entries()]
          .sort((a, b) => b[1] - a[1] || byName(a[0], b[0]))
          .map(([tag]) => tag);
        return new Map(ordered.map((tag, i) => [tag, i]));
      },
      // Coocorrência: as tags que mais aparecem nos vídeos da coleção que têm
      // **todas** as tags atuais. Com lista vazia o `every` é verdadeiro para
      // todos, então "vídeo sem tag" cai na contagem da coleção sem ramo próprio.
      recommendFor: (collectionId: number, tags: string[]) => {
        const counts = new Map<string, number>();
        for (const entry of byCollection.get(collectionId) ?? []) {
          if (!tags.every((t) => entry.tags.includes(t))) continue;
          for (const tag of entry.tags) {
            if (!tags.includes(tag)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
          }
        }
        return [...counts.entries()]
          .sort((a, b) => b[1] - a[1] || byName(a[0], b[0]))
          .slice(0, CARD_SUGGESTION_LIMIT)
          .map(([tag]) => tag);
      },
      setTags: (entryId: string, tags: string[]) => {
        void updateEntry(entryId, { tags });
      },
    };
  }, [byCollection, updateEntry]);

  const groups = useMemo(() => {
    let result = buildYoutubeCollectionGroups(entries);
    if (collectionFilter.length > 0) {
      result = result.filter((g) => {
        const cid = g.representative.collectionId;
        return collectionFilter.some((f) => (f === "none" ? cid == null : cid === f));
      });
    }
    result = applyStatusView(result, activeStatus);
    result = result.filter((g) => matchesSearch(g, search));

    const nameOf = (g: YoutubeGroup) => {
      const cid = g.representative.collectionId;
      return cid != null ? collections.byId.get(cid) ?? "" : g.representative.title;
    };
    return sort.field === "views"
      ? sortGroupsBySumViews(result, viewsOf, sort.dir)
      : sort.field === "date"
      ? sortGroupsByMemberDate(result, videoDateOf, sort.dir)
      : sortGroupsByName(result, nameOf, sort.dir);
  }, [entries, collectionFilter, activeStatus, search, collections.byId, sort.field, sort.dir]);

  const gridKey = `${activeStatus}-${collectionFilter.join(",")}-${sort.field}-${sort.dir}-${search}`;

  const drawerEntry = drawerVideoId ? findByVideoId(drawerVideoId) : undefined;
  const modalEntry = modalVideoId ? findByVideoId(modalVideoId) : undefined;

  // No modo remover, só faz sentido oferecer tag que os selecionados têm.
  const bulkTags = useMemo(() => {
    if (!bulk) return [];
    const ids = new Set(bulk.ids);
    const selected = entries.filter((e) => ids.has(e.id));
    if (bulk.mode === "remove") {
      const set = new Set<string>();
      for (const e of selected) for (const tag of e.tags) set.add(tag);
      return [...set].sort(byName);
    }
    // Adicionar: o vocabulário é o da coleção dos selecionados (todos na mesma,
    // garantido pelo FranchiseGrid).
    const collectionId = selected[0]?.collectionId;
    return collectionId != null ? tagContext.allTagsFor(collectionId) : [];
  }, [bulk, entries, tagContext]);

  // A faixa de filtro vive dentro da expansão: as tags que mais acompanham as já
  // marcadas, contadas sobre os membros **já visíveis** — daí toda sugestão ter
  // pelo menos um resultado, e a faixa sumir quando a combinação esgota as
  // companheiras. Só reduz a expansão: capa e badge não enxergam esse filtro.
  const renderExpansion = useCallback(
    (group: YoutubeGroup, renderMembers: (members: YoutubeLibraryEntry[]) => ReactNode) => {
      if (group.representative.collectionId == null) return renderMembers(group.members);

      const selected = tagFilter[group.key] ?? [];
      const visible = group.members.filter((m) => selected.every((t) => m.tags.includes(t)));

      const counts = new Map<string, number>();
      for (const m of visible) for (const tag of m.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      const suggestions = [...counts.entries()]
        .filter(([tag]) => !selected.includes(tag))
        .sort((a, b) => b[1] - a[1] || byName(a[0], b[0]))
        .slice(0, FILTER_SUGGESTION_LIMIT)
        .map(([tag]) => tag);

      const setFor = (tags: string[]) => setTagFilter((prev) => ({ ...prev, [group.key]: tags }));

      return (
        <>
          <div className={styles.expansionFilter}>
            <TagSuggestionRow
              tags={suggestions}
              hasFilter={selected.length > 0}
              onPick={(tag) => setFor([...selected, tag])}
            />
            <SelectedTagRow
              tags={selected}
              onRemove={(tag) => setFor(selected.filter((t) => t !== tag))}
              onClear={() => setFor([])}
            />
          </div>
          {renderMembers(visible)}
        </>
      );
    },
    [tagFilter]
  );

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
          coverIsCollectionOnly
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
          extraActions={[
            { label: "Adicionar tag", onClick: (ids) => setBulk({ mode: "add", ids }) },
            { label: "Remover tag", onClick: (ids) => setBulk({ mode: "remove", ids }) },
          ]}
          renderExpansion={renderExpansion}
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
          // key por vídeo: o drawer registra o acesso na montagem e congela a
          // data anterior para exibir, então trocar de vídeo precisa remontar.
          key={drawerEntry.id}
          entry={drawerEntry}
          onClose={() => setDrawerVideoId(null)}
          onOpen={() => { void registerAccess(drawerEntry.id); }}
          onNotesChange={(notes) => { void updateEntry(drawerEntry.id, { notes }); }}
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
            void removeEntry(id).then(() => collections.reload());
            setModalVideoId(null);
          }}
          onSetCover={(id) => {
            setCoverEntry(id);
            setModalVideoId(null);
          }}
        />
      )}

      {bulk && (
        <TagBulkModal
          mode={bulk.mode}
          count={bulk.ids.length}
          allTags={bulkTags}
          onPick={(tag) => {
            void (bulk.mode === "add" ? addTagMany(bulk.ids, tag) : removeTagMany(bulk.ids, tag));
            setBulk(null);
          }}
          onClose={() => setBulk(null)}
        />
      )}
    </div>
  );
}
