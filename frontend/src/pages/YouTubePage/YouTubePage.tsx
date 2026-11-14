import { useState, useCallback, useMemo } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { YoutubeWatch } from "../../components/YoutubeWatch/YoutubeWatch";
import { YoutubeListControls } from "../../components/YoutubeWatch/YoutubeListControls";
import { YoutubeLibraryModal } from "../../components/YoutubeLibraryModal/YoutubeLibraryModal";
import { TabNav } from "../../components/TabNav/TabNav";
import { useYoutubeLibrary } from "../../hooks/useYoutubeLibrary";
import { useSingleSort } from "../../hooks/useSingleSort";
import type { YoutubeKind, YoutubeLibraryEntry, YoutubeLibraryStatus } from "../../types/youtubeLibrary";
import { YOUTUBE_KIND_LABELS, otherKind } from "../../types/youtubeLibrary";
import { visibleTracks, channelGroups, trackNeighbors, pickInitialTrack } from "../../utils/youtubeList";
import { useOnline } from "../../context/connectivityContext";
import styles from "./YouTubePage.module.css";

const YOUTUBE_PATH = "/youtube";
const AUTOPLAY_STORAGE_KEY = "youtube-autoplay";
const GROUP_STORAGE_KEY = "youtube-group-by-channel";

const KIND_TABS = (Object.entries(YOUTUBE_KIND_LABELS) as [YoutubeKind, string][]).map(([id, label]) => ({
  id,
  label,
}));

const ADDED_NOUNS: Record<YoutubeKind, [string, string]> = {
  music: ["música adicionada", "músicas adicionadas"],
  video: ["vídeo adicionado", "vídeos adicionados"],
};

// O YouTube não tem tela de biblioteca: a página É a tela de reprodução.
// `/youtube` redireciona para o último item tocado, e a lista da direita (abas
// de músicas/vídeos, busca, ordenação e agrupamento por canal) faz o papel da
// biblioteca.
export function YouTubePage() {
  const online = useOnline();
  // null = ninguém escolheu aba ainda: ela acompanha o tipo do item aberto.
  const [kindChoice, setKindChoice] = useState<YoutubeKind | null>(null);
  const [activeStatus, setActiveStatus] = useState<YoutubeLibraryStatus>("liked");
  const [search, setSearch] = useState("");
  const [groupByChannel, setGroupByChannel] = useState(() => localStorage.getItem(GROUP_STORAGE_KEY) === "true");
  const [openChannelKey, setOpenChannelKey] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addNotice, setAddNotice] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [autoplay, setAutoplay] = useState(() => localStorage.getItem(AUTOPLAY_STORAGE_KEY) !== "false");
  const sort = useSingleSort("alpha", "asc");
  // Segmento opcional numa rota só: a página não desmonta ao trocar de item,
  // então o player, a busca e a ordenação sobrevivem à troca.
  const { videoId: watchVideoId } = useParams<{ videoId?: string }>();
  const navigate = useNavigate();

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

  const watchEntry = watchVideoId ? findByVideoId(watchVideoId) : undefined;
  const activeKind = kindChoice ?? watchEntry?.kind ?? "music";

  const handleAdd = useCallback(async () => {
    const url = urlInput.trim();
    if (!url || adding) return;
    setAdding(true);
    setAddError(null);
    setAddNotice(null);
    try {
      const result = await addFromUrl(url, activeKind);
      setUrlInput("");
      const [one, many] = ADDED_NOUNS[activeKind];
      if (result && "playlist" in result) {
        const { name, imported, total } = result.playlist;
        const skipped = total - imported;
        setAddNotice(
          `Playlist "${name}": ${imported} ${imported === 1 ? one : many}` +
            (skipped > 0 ? ` (${skipped} já ${skipped === 1 ? "estava" : "estavam"} na biblioteca)` : "")
        );
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
    (videoId: string) => {
      navigate(`${YOUTUBE_PATH}/${videoId}`);
    },
    [navigate]
  );

  const changeAutoplay = useCallback((value: boolean) => {
    setAutoplay(value);
    localStorage.setItem(AUTOPLAY_STORAGE_KEY, String(value));
  }, []);

  const changeGrouping = useCallback((value: boolean) => {
    setGroupByChannel(value);
    setOpenChannelKey(null);
    localStorage.setItem(GROUP_STORAGE_KEY, String(value));
  }, []);

  // Canal aberto é de uma aba: trocar de aba volta para a lista de canais.
  const changeKind = useCallback((kind: YoutubeKind) => {
    setKindChoice(kind);
    setOpenChannelKey(null);
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
  // Canal que a busca ou a aba tiraram de vista deixa de estar aberto por
  // derivação — a lista volta para os canais sem efeito para limpar estado.
  const openChannel = channels?.find((channel) => channel.key === openChannelKey);
  const listTracks = openChannel ? openChannel.tracks : tracks;
  // Anterior/próximo seguem o que está na lista; agrupada e sem canal aberto,
  // percorrem todos os itens na ordem dos canais.
  const playOrder = useMemo(
    () => (channels && !openChannel ? channels.flatMap((channel) => channel.tracks) : listTracks),
    [channels, openChannel, listTracks]
  );

  const initialTrack = useMemo(() => pickInitialTrack(entries), [entries]);

  const addBar = (
    <>
      <h1 className={styles.srOnly}>YouTube</h1>
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
      {addError && <div className={styles.addError}>{addError}</div>}
      {addNotice && <div className={styles.addNotice}>{addNotice}</div>}
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

  return (
    <div className={styles.page}>
      {addBar}

      <YoutubeWatch
        // Sem `key`: remontar a tela recriaria o player e derrubaria a tela
        // cheia a cada item.
        entry={watchEntry}
        kind={activeKind}
        onKindChange={changeKind}
        tracks={listTracks}
        playOrder={playOrder}
        channels={channels}
        openChannel={openChannel}
        onOpenChannel={setOpenChannelKey}
        onCloseChannel={() => setOpenChannelKey(null)}
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
            onStatusChange={setActiveStatus}
            search={search}
            onSearchChange={setSearch}
            sortField={sort.field}
            sortDir={sort.dir}
            onSortSelect={sort.select}
            groupByChannel={groupByChannel}
            onGroupByChannelChange={changeGrouping}
          />
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
            // Remover o item atual segue para o próximo da lista; sem próximo,
            // a rota fica órfã e o redirect acima escolhe outro (ou o vazio).
            const { next } = trackNeighbors(playOrder, watchEntry.videoId);
            setModalOpen(false);
            if (next) navigate(`${YOUTUBE_PATH}/${next.videoId}`, { replace: true });
            void removeEntry(id);
          }}
        />
      )}
    </div>
  );
}
