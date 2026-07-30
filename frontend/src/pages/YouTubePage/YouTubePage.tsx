import { useState, useCallback, useMemo } from "react";
import { TabNav } from "../../components/TabNav/TabNav";
import { MediaGrid } from "../../components/MediaGrid/MediaGrid";
import { YoutubeDrawer } from "../../components/YoutubeDrawer/YoutubeDrawer";
import { YoutubeLibraryModal } from "../../components/YoutubeLibraryModal/YoutubeLibraryModal";
import { LibraryControls, type FilterGroupConfig } from "../../components/LibraryControls/LibraryControls";
import { TagBulkModal, type TagBulkMode } from "../../components/TagBulkModal/TagBulkModal";
import { YoutubeTagContext } from "../../context/youtubeTagContext";
import { youtubeCardConfig } from "../../config/cards";
import { useYoutubeLibrary } from "../../hooks/useYoutubeLibrary";
import { useAppSetting } from "../../hooks/useAppSetting";
import { useSingleSort } from "../../hooks/useSingleSort";
import type { YoutubeCard, YoutubeLibraryEntry, YoutubeLibraryStatus, TagBucket } from "../../types/youtubeLibrary";
import {
  YOUTUBE_LIBRARY_STATUS_LABELS,
  DEFAULT_TAG_BUCKETS,
  TAG_BUCKETS_KEY,
} from "../../types/youtubeLibrary";
import { youtubeLibraryEntryToCard } from "../../utils/youtubeLibraryEntryToCard";
import styles from "./YouTubePage.module.css";

const STATUS_TABS = (Object.entries(YOUTUBE_LIBRARY_STATUS_LABELS) as [YoutubeLibraryStatus, string][]).map(
  ([id, label]) => ({ id, label })
);

// Sentinela da opção "sem canal".
const NONE = "none";

const COLLATOR_OPTS = { sensitivity: "base" } as const;

const SUGGESTION_LIMIT = 4;

function byName(a: string, b: string): number {
  return a.localeCompare(b, "pt-BR", COLLATOR_OPTS);
}

function publishedTime(entry: YoutubeLibraryEntry): number {
  return entry.publishedAt ? new Date(entry.publishedAt).getTime() : 0;
}

export function YouTubePage() {
  const [activeStatus, setActiveStatus] = useState<YoutubeLibraryStatus>("liked");
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addNotice, setAddNotice] = useState<string | null>(null);
  const [drawerVideoId, setDrawerVideoId] = useState<string | null>(null);
  const [modalVideoId, setModalVideoId] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ mode: TagBulkMode; ids: string[] } | null>(null);
  const sort = useSingleSort("alpha", "asc");

  const { value: buckets } = useAppSetting<TagBucket[]>(TAG_BUCKETS_KEY, DEFAULT_TAG_BUCKETS);

  const {
    entries,
    loading,
    error,
    update: updateEntry,
    updateMany: updateManyEntries,
    remove: removeEntry,
    findByVideoId,
    addFromUrl,
    addTagMany,
    removeTagMany,
  } = useYoutubeLibrary();

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
          `Playlist "${result.playlist.name}" adicionada — ${result.playlist.imported} vídeos com a tag "${result.playlist.name}"`
        );
      }
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setAddError(msg ?? "Erro ao adicionar vídeo.");
    } finally {
      setAdding(false);
    }
  }, [urlInput, adding, addFromUrl]);

  const handleCardClick = useCallback((card: YoutubeCard) => {
    setDrawerVideoId(card.id);
  }, []);

  const handleOpenModal = useCallback((card: YoutubeCard) => {
    setModalVideoId(card.id);
  }, []);

  // Lista do menu em ordem alfabética: com muitas tags é o que dá para varrer.
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) for (const tag of entry.tags) set.add(tag);
    return [...set].sort(byName);
  }, [entries]);

  // Aba de status é a base de tudo.
  const inTab = useMemo(() => entries.filter((e) => e.status === activeStatus), [entries, activeStatus]);

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inTab;
    return inTab.filter(
      (e) => e.title.toLowerCase().includes(q) || (e.channelTitle ?? "").toLowerCase().includes(q)
    );
  }, [inTab, search]);

  // Ranking de popularidade: sai da aba inteira, sem sofrer com busca nem com
  // filtro marcado, e desempata alfabeticamente. É isso que mantém cada tag no
  // mesmo bucket enquanto se filtra — ela só sai de vista, nunca muda de grupo.
  // O mesmo ranking ordena os chips dentro do card.
  const ranking = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of inTab) for (const tag of entry.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || byName(a[0], b[0]))
      .map(([tag]) => tag);
  }, [inTab]);

  const tagRank = useMemo(() => new Map(ranking.map((tag, i) => [tag, i])), [ranking]);

  // Coocorrência: as tags que mais aparecem nos vídeos que têm **todas** as tags
  // atuais. Com lista vazia o `every` é verdadeiro para todos, então "vídeo sem
  // tag" cai na contagem global sem precisar de ramo próprio. Desempate
  // alfabético para a sugestão não trocar de lugar entre renders.
  const recommendFor = useMemo(
    () => (tags: string[]) => {
      const counts = new Map<string, number>();
      for (const entry of inTab) {
        if (!tags.every((t) => entry.tags.includes(t))) continue;
        for (const tag of entry.tags) {
          if (!tags.includes(tag)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || byName(a[0], b[0]))
        .slice(0, SUGGESTION_LIMIT)
        .map(([tag]) => tag);
    },
    [inTab]
  );

  const tagContext = useMemo(
    () => ({
      allTags,
      tagRank,
      recommendFor,
      setTags: (entryId: string, tags: string[]) => {
        void updateEntry(entryId, { tags });
      },
    }),
    [allTags, tagRank, recommendFor, updateEntry]
  );

  // Filtro: canal em OU dentro do grupo, tags em E (vídeo precisa ter todas).
  const hitsChannel = useCallback(
    (e: YoutubeLibraryEntry) =>
      channelFilter.length === 0 || channelFilter.includes(e.channelTitle ?? NONE),
    [channelFilter]
  );
  const hitsTags = useCallback(
    (e: YoutubeLibraryEntry) => tagFilter.every((t) => e.tags.includes(t)),
    [tagFilter]
  );

  const visible = useMemo(
    () => searched.filter((e) => hitsChannel(e) && hitsTags(e)),
    [searched, hitsChannel, hitsTags]
  );

  // Canal cruza com as tags: as opções saem do conjunto já filtrado por tag.
  const channelOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of searched.filter(hitsTags)) {
      const key = e.channelTitle ?? NONE;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const value of channelFilter) if (!counts.has(value)) counts.set(value, 0);
    const named = [...counts.entries()]
      .filter(([v]) => v !== NONE)
      .sort((a, b) => byName(a[0], b[0]))
      .map(([value, count]) => ({ value, label: value, count }));
    const none = counts.get(NONE);
    return none != null ? [{ value: NONE, label: "Sem canal", count: none }, ...named] : named;
  }, [searched, hitsTags, channelFilter]);

  // Contagem da tag = "quantos resultados se eu marcar isso": conta sobre o
  // conjunto já filtrado. Com E isso é o que mostra o beco sem saída antes do
  // clique. Opção com 0 é escondida — menos se estiver marcada, senão a seleção
  // ficaria invisível filtrando tudo, sem como desfazer.
  const tagCounts = useMemo(() => {
    const base = searched.filter((e) => hitsChannel(e) && hitsTags(e));
    const counts = new Map<string, number>();
    for (const e of base) for (const tag of e.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return counts;
  }, [searched, hitsChannel, hitsTags]);

  // Fatiamento: o bucket i pega o ranking em (topAnterior, top]; top null = resto.
  // Faixa vazia (depois de esconder as opções irrelevantes) não vira grupo.
  const tagGroups = useMemo(() => {
    const groups: FilterGroupConfig[] = [];
    let start = 0;
    for (const bucket of buckets) {
      if (!bucket.label.trim()) continue;
      const end = bucket.top == null ? ranking.length : Math.min(bucket.top, ranking.length);
      if (end <= start) {
        if (bucket.top != null) start = Math.max(start, end);
        continue;
      }
      const options = ranking
        .slice(start, end)
        .map((tag) => ({ value: tag, label: tag, count: tagCounts.get(tag) ?? 0 }))
        .filter((opt) => opt.count > 0 || tagFilter.includes(opt.value));
      start = end;
      if (options.length === 0) continue;
      groups.push({
        key: `bucket-${bucket.label}`,
        title: bucket.label,
        options,
        selected: tagFilter,
        onToggle: (v: string) =>
          setTagFilter((prev) => (prev.includes(v) ? prev.filter((t) => t !== v) : [...prev, v])),
      });
    }
    return groups;
  }, [buckets, ranking, tagCounts, tagFilter]);

  const filterGroups: FilterGroupConfig[] = [
    ...(channelOptions.length > 0
      ? [
          {
            key: "channel",
            title: "Canal",
            options: channelOptions,
            selected: channelFilter,
            onToggle: (v: string) =>
              setChannelFilter((prev) => (prev.includes(v) ? prev.filter((c) => c !== v) : [...prev, v])),
          },
        ]
      : []),
    ...tagGroups,
  ];

  const videos = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const compare = (a: YoutubeLibraryEntry, b: YoutubeLibraryEntry) => {
      if (sort.field === "views") return ((a.viewCount ?? 0) - (b.viewCount ?? 0)) * dir;
      if (sort.field === "date") return (publishedTime(a) - publishedTime(b)) * dir;
      return byName(a.title, b.title) * dir;
    };
    return [...visible].sort(compare).map(youtubeLibraryEntryToCard);
  }, [visible, sort.field, sort.dir]);

  const filtering = search.trim() !== "" || channelFilter.length > 0 || tagFilter.length > 0;

  const clearFilters = () => {
    setChannelFilter([]);
    setTagFilter([]);
  };

  const gridKey = [
    activeStatus,
    search,
    channelFilter.join(","),
    tagFilter.join(","),
    sort.field,
    sort.dir,
  ].join("-");

  const drawerEntry = drawerVideoId ? findByVideoId(drawerVideoId) : undefined;
  const modalEntry = modalVideoId ? findByVideoId(modalVideoId) : undefined;

  // No modo remover, só faz sentido oferecer tag que os selecionados têm.
  const bulkTags = useMemo(() => {
    if (!bulk) return [];
    if (bulk.mode === "add") return allTags;
    const ids = new Set(bulk.ids);
    const set = new Set<string>();
    for (const e of entries) if (ids.has(e.id)) for (const tag of e.tags) set.add(tag);
    return [...set].sort(byName);
  }, [bulk, allTags, entries]);

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
        count={videos.length}
        filterGroups={filterGroups}
        filterSearchPlaceholder="Buscar tag ou canal..."
        onClearFilters={clearFilters}
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
        <MediaGrid
          items={videos}
          config={youtubeCardConfig}
          loading={loading}
          error={error}
          hasNextPage={false}
          onLoadMore={() => undefined}
          onCardClick={handleCardClick}
          onAddToLibrary={handleOpenModal}
          getLibraryEntry={(id) => findByVideoId(id)}
          statusLabels={YOUTUBE_LIBRARY_STATUS_LABELS}
          onBulkSetStatus={(ids, status) => updateManyEntries(ids, status)}
          extraActions={[
            { label: "Adicionar tag", onClick: (ids) => setBulk({ mode: "add", ids }) },
            { label: "Remover tag", onClick: (ids) => setBulk({ mode: "remove", ids }) },
          ]}
          isLibraryView
          animationKey={gridKey}
          gridClassName={styles.youtubeGrid}
          emptyMessage={filtering ? "Nenhum vídeo com esses filtros." : "Nada por aqui ainda."}
          emptyHint={
            filtering
              ? "Troque a seleção ou use \"Limpar tudo\" no painel de filtros."
              : "Cole o link de um vídeo do YouTube para começar!"
          }
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
