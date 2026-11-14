import { useState, useCallback, useMemo } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { MusicWatch } from "../../components/MusicWatch/MusicWatch";
import { MusicQueueControls } from "../../components/MusicWatch/MusicQueueControls";
import { YoutubeLibraryModal } from "../../components/YoutubeLibraryModal/YoutubeLibraryModal";
import { useMusicLibrary } from "../../hooks/useMusicLibrary";
import { useSingleSort } from "../../hooks/useSingleSort";
import type { MusicLibraryStatus } from "../../types/musicLibrary";
import { visibleTracks, trackNeighbors, pickInitialTrack } from "../../utils/musicList";
import { useOnline } from "../../context/connectivityContext";
import styles from "./MusicPage.module.css";

const MUSIC_PATH = "/musica";
const AUTOPLAY_STORAGE_KEY = "music-autoplay";

// Música não tem tela de biblioteca: a página É a tela de reprodução. `/musica`
// redireciona para a última música tocada, e a lista da direita (com busca,
// ordenação e abas) faz o papel da biblioteca.
export function MusicPage() {
  const online = useOnline();
  const [activeStatus, setActiveStatus] = useState<MusicLibraryStatus>("liked");
  const [search, setSearch] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addNotice, setAddNotice] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [autoplay, setAutoplay] = useState(() => localStorage.getItem(AUTOPLAY_STORAGE_KEY) !== "false");
  const sort = useSingleSort("alpha", "asc");
  // Segmento opcional numa rota só: a página não desmonta ao trocar de música,
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
      } else if (result) {
        // Sem grade para ver o card novo aparecer, o aviso é a confirmação.
        setAddNotice(`"${result.title}" adicionada.`);
      }
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setAddError(msg ?? "Erro ao adicionar música.");
    } finally {
      setAdding(false);
    }
  }, [urlInput, adding, addFromUrl]);

  const openTrack = useCallback(
    (videoId: string) => {
      navigate(`${MUSIC_PATH}/${videoId}`);
    },
    [navigate]
  );

  const changeAutoplay = useCallback((value: boolean) => {
    setAutoplay(value);
    localStorage.setItem(AUTOPLAY_STORAGE_KEY, String(value));
  }, []);

  const tracks = useMemo(
    () => visibleTracks(entries, { status: activeStatus, search, sortField: sort.field, sortDir: sort.dir }),
    [entries, activeStatus, search, sort.field, sort.dir]
  );

  const watchEntry = watchVideoId ? findByVideoId(watchVideoId) : undefined;
  const initialTrack = useMemo(() => pickInitialTrack(entries), [entries]);

  const addBar = (
    <>
      <h1 className={styles.srOnly}>Música</h1>
      <div className={styles.addBar}>
        <input
          className={styles.addInput}
          type="text"
          value={urlInput}
          placeholder="Cole o link de uma música ou playlist do YouTube..."
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleAdd();
          }}
        />
        <button
          className={styles.addButton}
          onClick={() => { void handleAdd(); }}
          disabled={adding || !urlInput.trim() || !online}
          title={online ? undefined : "Sem conexão — adicionar música precisa de internet."}
        >
          {adding ? "Adicionando..." : "Adicionar"}
        </button>
      </div>
      {addError && <div className={styles.addError}>{addError}</div>}
      {addNotice && <div className={styles.addNotice}>{addNotice}</div>}
    </>
  );

  if (!watchEntry) {
    // `/musica` puro, ou um id que não está (mais) na biblioteca: cai na música
    // inicial. `replace` para o voltar do navegador não ficar preso no redirect.
    if (initialTrack) return <Navigate to={`${MUSIC_PATH}/${initialTrack.videoId}`} replace />;
    return (
      <div className={styles.page}>
        {addBar}
        {!loading && (
          <div className={styles.empty}>
            {error ?? "Nada por aqui ainda. Cole o link de uma música do YouTube para começar!"}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {addBar}

      <MusicWatch
        // Sem `key`: remontar a tela recriaria o player e derrubaria a tela
        // cheia a cada música.
        entry={watchEntry}
        tracks={tracks}
        autoplay={autoplay}
        onAutoplayChange={changeAutoplay}
        onSelect={openTrack}
        onPlayed={() => { void registerAccess(watchEntry.id); }}
        onEdit={() => setModalOpen(true)}
        onNotesChange={(notes) => { void updateEntry(watchEntry.id, { notes }); }}
        controls={
          <MusicQueueControls
            status={activeStatus}
            onStatusChange={setActiveStatus}
            search={search}
            onSearchChange={setSearch}
            sortField={sort.field}
            sortDir={sort.dir}
            onSortSelect={sort.select}
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
            // Remover a música atual segue para a próxima da lista; sem próxima,
            // a rota fica órfã e o redirect acima escolhe outra (ou o vazio).
            const { next } = trackNeighbors(tracks, watchEntry.videoId);
            setModalOpen(false);
            if (next) navigate(`${MUSIC_PATH}/${next.videoId}`, { replace: true });
            void removeEntry(id);
          }}
        />
      )}
    </div>
  );
}
