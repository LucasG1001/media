import { useState, useCallback, useMemo, useRef } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { YoutubeWatch } from "../../components/YoutubeWatch/YoutubeWatch";
import { YoutubeListControls } from "../../components/YoutubeWatch/YoutubeListControls";
import { YoutubeSelectionBar } from "../../components/YoutubeWatch/YoutubeSelectionBar";
import { YoutubeLibraryModal } from "../../components/YoutubeLibraryModal/YoutubeLibraryModal";
import { TabNav } from "../../components/TabNav/TabNav";
import { TopbarSlot } from "../../components/TopbarSlot/TopbarSlot";
import { useYoutubeLibrary } from "../../hooks/useYoutubeLibrary";
import { useYoutubePlaylists } from "../../hooks/useYoutubePlaylists";
import { useSingleSort } from "../../hooks/useSingleSort";
import type { YoutubeKind, YoutubeLibraryEntry, YoutubeLibraryStatus } from "../../types/youtubeLibrary";
import { YOUTUBE_KIND_LABELS, otherKind } from "../../types/youtubeLibrary";
import {
  visibleTracks,
  channelGroups,
  playlistGroups,
  playlistsOfKind,
  shuffleTracks,
  toggleSelection,
  toggleGroupSelection,
  trackNeighbors,
  pickInitialTrack,
} from "../../utils/youtubeList";
import { useOnline } from "../../context/connectivityContext";
import styles from "./YouTubePage.module.css";

const YOUTUBE_PATH = "/youtube";
const AUTOPLAY_STORAGE_KEY = "youtube-autoplay";
const GROUP_STORAGE_KEY = "youtube-group-by-channel";
const PLAYLISTS_STORAGE_KEY = "youtube-show-playlists";
const SHUFFLE_STORAGE_KEY = "youtube-shuffle";
// O limite do nome no servidor; título de playlist do YouTube pode passar disso.
const PLAYLIST_NAME_MAX = 120;

const KIND_TABS = (Object.entries(YOUTUBE_KIND_LABELS) as [YoutubeKind, string][]).map(([id, label]) => ({
  id,
  label,
}));

const ADDED_NOUNS: Record<YoutubeKind, [string, string]> = {
  music: ["música adicionada", "músicas adicionadas"],
  video: ["vídeo adicionado", "vídeos adicionados"],
};

// Playlist do YouTube recém-colada: os itens entram soltos, e a tela oferece
// juntá-los numa playlist daqui.
interface PlaylistOffer {
  name: string;
  kind: YoutubeKind;
  videoIds: string[];
}

// `?list=` é a playlist de onde o item está tocando: é o que prende
// anterior/próximo/automático nela e diz qual das linhas repetidas destacar.
function trackPath(videoId: string, playlistId?: string): string {
  return playlistId ? `${YOUTUBE_PATH}/${videoId}?list=${playlistId}` : `${YOUTUBE_PATH}/${videoId}`;
}

function newShuffleSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

function itemsLabel(count: number): string {
  return `${count} ${count === 1 ? "item" : "itens"}`;
}

// O YouTube não tem tela de biblioteca: a página É a tela de reprodução.
// `/youtube` redireciona para o último item tocado, e a lista da direita (abas
// de músicas/vídeos, busca, ordenação, agrupamento por canal e playlists) faz o
// papel da biblioteca.
export function YouTubePage() {
  const online = useOnline();
  // null = ninguém escolheu aba ainda: ela acompanha o tipo do item aberto.
  const [kindChoice, setKindChoice] = useState<YoutubeKind | null>(null);
  const [activeStatus, setActiveStatus] = useState<YoutubeLibraryStatus>("liked");
  const [search, setSearch] = useState("");
  const [groupByChannel, setGroupByChannel] = useState(() => localStorage.getItem(GROUP_STORAGE_KEY) === "true");
  // Só as chaves: canal que a busca tirou de vista não é desenhado, e volta
  // aberto quando reaparece — sem efeito para limpar estado.
  const [openChannels, setOpenChannels] = useState<ReadonlySet<string>>(() => new Set());
  const [urlInput, setUrlInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addNotice, setAddNotice] = useState<string | null>(null);
  const [playlistOffer, setPlaylistOffer] = useState<PlaylistOffer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [autoplay, setAutoplay] = useState(() => localStorage.getItem(AUTOPLAY_STORAGE_KEY) !== "false");
  const sort = useSingleSort("alpha", "asc");
  // Segmento opcional numa rota só: a página não desmonta ao trocar de item,
  // então o player, a busca e a ordenação sobrevivem à troca.
  const { videoId: watchVideoId } = useParams<{ videoId?: string }>();
  const [searchParams] = useSearchParams();
  const listParam = searchParams.get("list");
  const navigate = useNavigate();

  const [showPlaylists, setShowPlaylists] = useState(() => localStorage.getItem(PLAYLISTS_STORAGE_KEY) === "true");
  // Abrir a página já dentro de uma playlist (recarregar com `?list=`) a mostra aberta.
  const [openPlaylists, setOpenPlaylists] = useState<ReadonlySet<string>>(
    () => new Set(listParam ? [listParam] : [])
  );
  const [shuffle, setShuffle] = useState(() => localStorage.getItem(SHUFFLE_STORAGE_KEY) === "true");
  const [shuffleSeed, setShuffleSeed] = useState(newShuffleSeed);
  // null = fora do modo de seleção. Os ids ficam na ordem em que foram marcados,
  // que é a ordem em que entram na playlist.
  const [selected, setSelected] = useState<ReadonlySet<string> | null>(null);
  // O último item clicado: a outra ponta do intervalo do Shift+clique.
  const selectionAnchor = useRef<string | null>(null);

  const {
    entries,
    loading,
    error,
    update: updateEntry,
    remove: removeEntry,
    findByVideoId,
    registerAccess,
    addFromUrl,
  } = useYoutubeLibrary();

  const {
    playlists,
    error: playlistError,
    create: createPlaylist,
    rename: renamePlaylist,
    remove: removePlaylist,
    addItems: addPlaylistItems,
    removeItems: removePlaylistItems,
  } = useYoutubePlaylists();

  const watchEntry = watchVideoId ? findByVideoId(watchVideoId) : undefined;
  const watchKind = watchEntry?.kind;
  const activeKind = kindChoice ?? watchKind ?? "music";

  const handleAdd = useCallback(async () => {
    const url = urlInput.trim();
    if (!url || adding) return;
    setAdding(true);
    setAddError(null);
    setAddNotice(null);
    setPlaylistOffer(null);
    try {
      const result = await addFromUrl(url, activeKind);
      setUrlInput("");
      const [one, many] = ADDED_NOUNS[activeKind];
      if (result && "playlist" in result) {
        const { name, imported, total, videoIds } = result.playlist;
        const skipped = total - imported;
        setAddNotice(
          `Playlist "${name}": ${imported} ${imported === 1 ? one : many}` +
            (skipped > 0 ? ` (${skipped} já ${skipped === 1 ? "estava" : "estavam"} na biblioteca)` : "")
        );
        setPlaylistOffer({ name: name.trim().slice(0, PLAYLIST_NAME_MAX), kind: activeKind, videoIds });
      } else if (result) {
        // Sem grade para ver o card novo aparecer, o aviso é a confirmação.
        setAddNotice(`"${result.title}": ${one} em ${YOUTUBE_KIND_LABELS[activeKind]}.`);
      }
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setAddError(msg ?? "Erro ao adicionar à biblioteca.");
    } finally {
      setAdding(false);
    }
  }, [urlInput, adding, addFromUrl, activeKind]);

  const openTrack = useCallback(
    (videoId: string, playlistId?: string) => {
      navigate(trackPath(videoId, playlistId));
    },
    [navigate]
  );

  const changeAutoplay = useCallback((value: boolean) => {
    setAutoplay(value);
    localStorage.setItem(AUTOPLAY_STORAGE_KEY, String(value));
  }, []);

  // Semente nova a cada vez que liga: religar é pedir outra ordem.
  const changeShuffle = useCallback((value: boolean) => {
    setShuffle(value);
    if (value) setShuffleSeed(newShuffleSeed());
    localStorage.setItem(SHUFFLE_STORAGE_KEY, String(value));
  }, []);

  const changeGrouping = useCallback((value: boolean) => {
    setGroupByChannel(value);
    setOpenChannels(new Set());
    localStorage.setItem(GROUP_STORAGE_KEY, String(value));
  }, []);

  const changeShowPlaylists = useCallback((value: boolean) => {
    setShowPlaylists(value);
    localStorage.setItem(PLAYLISTS_STORAGE_KEY, String(value));
  }, []);

  // A seleção é de uma lista só: trocar de aba ou de status a esvazia (o modo
  // continua ligado).
  const clearSelection = useCallback(() => {
    setSelected((current) => (current ? new Set() : current));
    selectionAnchor.current = null;
  }, []);

  // Canal aberto é de uma aba: trocar de aba fecha todos.
  const changeKind = useCallback(
    (kind: YoutubeKind) => {
      setKindChoice(kind);
      setOpenChannels(new Set());
      clearSelection();
    },
    [clearSelection]
  );

  const changeStatus = useCallback(
    (status: YoutubeLibraryStatus) => {
      setActiveStatus(status);
      clearSelection();
    },
    [clearSelection]
  );

  const changeSelecting = useCallback((value: boolean) => {
    setSelected(value ? new Set() : null);
    selectionAnchor.current = null;
  }, []);

  const toggleChannel = useCallback((key: string) => {
    setOpenChannels((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);

  const togglePlaylist = useCallback((id: string) => {
    setOpenPlaylists((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  // Depois de criar ou encher uma playlist por uma ação explícita, ela aparece:
  // liga o bloco e a abre.
  const revealPlaylist = useCallback(
    (id: string) => {
      changeShowPlaylists(true);
      setOpenPlaylists((current) => new Set(current).add(id));
    },
    [changeShowPlaylists]
  );

  const toggleSelect = useCallback((entry: YoutubeLibraryEntry, shiftKey: boolean, siblings: YoutubeLibraryEntry[]) => {
    const anchor = shiftKey ? selectionAnchor.current : null;
    const siblingIds = siblings.map((track) => track.id);
    setSelected((current) => (current ? toggleSelection(current, entry.id, siblingIds, anchor) : current));
    selectionAnchor.current = entry.id;
  }, []);

  const selectGroup = useCallback((group: YoutubeLibraryEntry[]) => {
    const groupIds = group.map((track) => track.id);
    setSelected((current) => (current ? toggleGroupSelection(current, groupIds) : current));
  }, []);

  // Fixa a aba antes de mover: sem escolha explícita ela acompanha o item
  // aberto, e mover o próprio item que toca faria a lista trocar de aba junto.
  const moveEntry = useCallback(
    (entry: YoutubeLibraryEntry) => {
      setKindChoice(activeKind);
      void updateEntry(entry.id, { kind: otherKind(entry.kind) });
    },
    [activeKind, updateEntry]
  );

  const tracks = useMemo(
    () =>
      visibleTracks(entries, {
        kind: activeKind,
        status: activeStatus,
        search,
        sortField: sort.field,
        sortDir: sort.dir,
      }),
    [entries, activeKind, activeStatus, search, sort.field, sort.dir]
  );

  const channels = useMemo(
    () => (groupByChannel ? channelGroups(tracks, sort.field, sort.dir) : undefined),
    [groupByChannel, tracks, sort.field, sort.dir]
  );
  // A lista de baixo inteira, na ordem da tela; agrupada, são todos os itens na
  // ordem dos canais — abertos ou não.
  const listOrder = useMemo(
    () => (channels ? channels.flatMap((channel) => channel.tracks) : tracks),
    [channels, tracks]
  );

  // As playlists da aba, para os menus (todas, sem a busca).
  const kindPlaylists = useMemo(() => playlistsOfKind(playlists, activeKind), [playlists, activeKind]);
  const itemPlaylists = useMemo(
    () => (watchKind ? playlistsOfKind(playlists, watchKind) : []),
    [playlists, watchKind]
  );

  // O bloco do topo. Dos filtros só a busca chega aqui; status e ordenação são
  // da lista de baixo.
  const playlistBlock = useMemo(
    () => (showPlaylists ? playlistGroups(playlists, entries, activeKind, search) : undefined),
    [showPlaylists, playlists, entries, activeKind, search]
  );
  // O contexto de reprodução só vale enquanto a playlist está na tela: com o
  // bloco desligado, em outra aba ou escondida pela busca, a reprodução volta a
  // seguir a lista de baixo (e retoma a playlist quando ela reaparece).
  const activePlaylist = useMemo(
    () => (listParam ? playlistBlock?.find((playlist) => playlist.id === listParam) : undefined),
    [listParam, playlistBlock]
  );

  // Anterior/próximo seguem o que está na tela: a playlist de onde o item toca
  // (embaralhada, se pedido) ou a lista de baixo.
  const playOrder = useMemo(() => {
    if (!activePlaylist) return listOrder;
    return shuffle ? shuffleTracks(activePlaylist.tracks, shuffleSeed) : activePlaylist.tracks;
  }, [activePlaylist, listOrder, shuffle, shuffleSeed]);

  const initialTrack = useMemo(() => pickInitialTrack(entries), [entries]);

  const selectedIds = useMemo(() => (selected ? [...selected] : []), [selected]);
  const allSelected = !!selected && listOrder.length > 0 && listOrder.every((track) => selected.has(track.id));

  const finishBulk = useCallback(
    (playlistId: string, name: string, count: number) => {
      setSelected(null);
      selectionAnchor.current = null;
      setAddError(null);
      setPlaylistOffer(null);
      setAddNotice(`Playlist "${name}": ${itemsLabel(count)} da seleção.`);
      revealPlaylist(playlistId);
    },
    [revealPlaylist]
  );

  const addSelectionTo = useCallback(
    async (playlistId: string) => {
      const target = playlists.find((playlist) => playlist.id === playlistId);
      if (!target || selectedIds.length === 0) return;
      if (await addPlaylistItems(playlistId, selectedIds)) finishBulk(playlistId, target.name, selectedIds.length);
    },
    [playlists, selectedIds, addPlaylistItems, finishBulk]
  );

  const createFromSelection = useCallback(
    async (name: string) => {
      const created = await createPlaylist(name, activeKind, selectedIds);
      if (created) finishBulk(created.id, created.name, selectedIds.length);
    },
    [createPlaylist, activeKind, selectedIds, finishBulk]
  );

  // Só os itens do tipo da aba em que o link foi colado: playlist é de uma aba
  // só, e o que já estava na biblioteca como o outro tipo fica de fora.
  const acceptPlaylistOffer = useCallback(async () => {
    if (!playlistOffer) return;
    const { name, kind, videoIds } = playlistOffer;
    const byVideoId = new Map(entries.map((entry) => [entry.videoId, entry]));
    const ids = [
      ...new Set(
        videoIds
          .map((videoId) => byVideoId.get(videoId))
          .filter((entry): entry is YoutubeLibraryEntry => !!entry && entry.kind === kind)
          .map((entry) => entry.id)
      ),
    ];
    const existing = playlists.find(
      (playlist) => playlist.kind === kind && playlist.name.toLowerCase() === name.toLowerCase()
    );
    let targetId: string | null = null;
    if (existing) {
      if (ids.length === 0 || (await addPlaylistItems(existing.id, ids))) targetId = existing.id;
    } else {
      targetId = (await createPlaylist(name, kind, ids))?.id ?? null;
    }
    if (!targetId) return;
    setPlaylistOffer(null);
    setAddNotice(`Playlist "${name}" ${existing ? "atualizada" : "criada"} com ${itemsLabel(ids.length)}.`);
    revealPlaylist(targetId);
  }, [playlistOffer, entries, playlists, addPlaylistItems, createPlaylist, revealPlaylist]);

  const offerExists =
    !!playlistOffer &&
    playlists.some(
      (playlist) =>
        playlist.kind === playlistOffer.kind && playlist.name.toLowerCase() === playlistOffer.name.toLowerCase()
    );

  const addBar = (
    <>
      <h1 className={styles.srOnly}>YouTube</h1>
      {/* O campo de link mora na barra superior no desktop; os avisos do
          resultado ficam na página, perto do que mudou. */}
      <TopbarSlot>
        <div className={styles.addBar}>
          <input
            className={styles.addInput}
            type="text"
            value={urlInput}
            placeholder={`Cole o link de um vídeo ou playlist para adicionar em ${YOUTUBE_KIND_LABELS[activeKind]}...`}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleAdd();
            }}
          />
          <button
            className={styles.addButton}
            onClick={() => { void handleAdd(); }}
            disabled={adding || !urlInput.trim() || !online}
            title={online ? undefined : "Sem conexão — adicionar precisa de internet."}
          >
            {adding ? "Adicionando..." : "Adicionar"}
          </button>
        </div>
      </TopbarSlot>
      {addError && <div className={styles.addError}>{addError}</div>}
      {playlistError && <div className={styles.addError}>{playlistError}</div>}
      {addNotice && (
        <div className={styles.addNotice}>
          {addNotice}
          {playlistOffer && (
            <button
              type="button"
              className={styles.noticeAction}
              onClick={() => { void acceptPlaylistOffer(); }}
              disabled={!online}
              title={online ? undefined : "Sem conexão — não dá para alterar agora."}
            >
              {offerExists ? "Adicionar à playlist" : "Criar playlist"} “{playlistOffer.name}”
            </button>
          )}
        </div>
      )}
    </>
  );

  if (!watchEntry) {
    // `/youtube` puro, ou um id que não está (mais) na biblioteca: cai no item
    // inicial. `replace` para o voltar do navegador não ficar preso no redirect.
    if (initialTrack) return <Navigate to={`${YOUTUBE_PATH}/${initialTrack.videoId}`} replace />;
    return (
      <div className={styles.page}>
        {addBar}
        {!loading && (
          <div className={styles.empty}>
            {error ? (
              error
            ) : (
              <>
                <div className={styles.emptyTabs}>
                  <TabNav plain tabs={KIND_TABS} activeTab={activeKind} onTabChange={(id) => changeKind(id as YoutubeKind)} />
                </div>
                Nada por aqui ainda. Cole um link do YouTube para começar!
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  const playlistsHint =
    showPlaylists && !search.trim() && kindPlaylists.length === 0
      ? `Nenhuma playlist em ${YOUTUBE_KIND_LABELS[activeKind]} ainda. Marque itens com “Selecionar vários” para criar uma.`
      : undefined;

  return (
    <div className={styles.page}>
      {addBar}

      <YoutubeWatch
        // Sem `key`: remontar a tela recriaria o player e derrubaria a tela
        // cheia a cada item.
        entry={watchEntry}
        kind={activeKind}
        onKindChange={changeKind}
        tracks={tracks}
        playOrder={playOrder}
        channels={channels}
        openChannels={openChannels}
        onToggleChannel={toggleChannel}
        playlists={playlistBlock}
        openPlaylists={openPlaylists}
        onTogglePlaylist={togglePlaylist}
        playlistsHint={playlistsHint}
        activePlaylistId={activePlaylist?.id}
        onRemoveFromPlaylist={(playlistId, entry) => { void removePlaylistItems(playlistId, [entry.id]); }}
        onRenamePlaylist={(playlistId, name) => { void renamePlaylist(playlistId, name); }}
        onDeletePlaylist={(playlistId) => { void removePlaylist(playlistId); }}
        shuffle={shuffle}
        onShuffleChange={changeShuffle}
        itemPlaylists={{
          playlists: itemPlaylists,
          onAdd: (playlistId) => { void addPlaylistItems(playlistId, [watchEntry.id]); },
          onRemove: (playlistId) => { void removePlaylistItems(playlistId, [watchEntry.id]); },
          onCreate: (name) => { void createPlaylist(name, watchEntry.kind, [watchEntry.id]); },
          disabled: !online,
        }}
        selection={selected ?? undefined}
        onToggleSelect={toggleSelect}
        onSelectGroup={selectGroup}
        autoplay={autoplay}
        onAutoplayChange={changeAutoplay}
        onSelect={openTrack}
        onPlayed={() => { void registerAccess(watchEntry.id); }}
        onEdit={() => setModalOpen(true)}
        onMove={moveEntry}
        onNotesChange={(notes) => { void updateEntry(watchEntry.id, { notes }); }}
        controls={
          <YoutubeListControls
            status={activeStatus}
            onStatusChange={changeStatus}
            search={search}
            onSearchChange={setSearch}
            sortField={sort.field}
            sortDir={sort.dir}
            onSortSelect={sort.select}
            groupByChannel={groupByChannel}
            onGroupByChannelChange={changeGrouping}
            showPlaylists={showPlaylists}
            onShowPlaylistsChange={changeShowPlaylists}
            selecting={selected !== null}
            onSelectingChange={changeSelecting}
          />
        }
        footer={
          selected && (
            <YoutubeSelectionBar
              entryIds={selectedIds}
              allSelected={allSelected}
              onToggleAll={() => selectGroup(listOrder)}
              onCancel={() => changeSelecting(false)}
              playlists={kindPlaylists}
              onAdd={(playlistId) => { void addSelectionTo(playlistId); }}
              onCreate={(name) => { void createFromSelection(name); }}
              online={online}
            />
          )
        }
      />

      {modalOpen && (
        <YoutubeLibraryModal
          entry={watchEntry}
          onClose={() => setModalOpen(false)}
          onSave={(id, data) => {
            void updateEntry(id, data);
            setModalOpen(false);
          }}
          onRemove={(id) => {
            // Remover o item atual segue para o próximo da ordem de reprodução
            // (dentro da playlist, se é de lá que ele toca); sem próximo, a rota
            // fica órfã e o redirect acima escolhe outro (ou o vazio).
            const { next } = trackNeighbors(playOrder, watchEntry.videoId);
            setModalOpen(false);
            if (next) navigate(trackPath(next.videoId, activePlaylist?.id), { replace: true });
            void removeEntry(id);
          }}
        />
      )}
    </div>
  );
}
