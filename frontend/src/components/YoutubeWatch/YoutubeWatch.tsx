import { useEffect, useRef, useState, type ReactNode } from "react";
import type { YoutubeKind, YoutubeLibraryEntry, YoutubePlaylist } from "../../types/youtubeLibrary";
import { YOUTUBE_KIND_LABELS, YOUTUBE_LIBRARY_STATUS_LABELS, otherKind } from "../../types/youtubeLibrary";
import { YoutubePlayer } from "../YoutubePlayer/YoutubePlayer";
import { CoverImage } from "../CoverImage/CoverImage";
import { NotesBlock } from "../NotesBlock/NotesBlock";
import { TabNav } from "../TabNav/TabNav";
import { YoutubePlaylistPicker } from "./YoutubePlaylistPicker";
import { YoutubePlaylistActions } from "./YoutubePlaylistActions";
import { formatDuration } from "../../utils/formatDuration";
import { formatViews } from "../../utils/formatViews";
import { formatLastAccess } from "../../utils/lastAccess";
import { trackNeighbors, type ChannelGroup, type PlaylistGroup } from "../../utils/youtubeList";
import styles from "./YoutubeWatch.module.css";

interface YoutubeWatchProps {
  entry: YoutubeLibraryEntry;
  // A aba do painel: músicas ou vídeos.
  kind: YoutubeKind;
  onKindChange: (kind: YoutubeKind) => void;
  // As linhas da lista, na ordem em que estão na tela. A lista não muda com o
  // item que toca: o atual só é destacado no lugar em que já estava.
  tracks: YoutubeLibraryEntry[];
  // De onde saem anterior/próximo e a reprodução automática. É a própria lista;
  // agrupada por canal, são todos os itens na ordem dos canais; tocando de
  // dentro de uma playlist, são os itens dela.
  playOrder: YoutubeLibraryEntry[];
  // Presente = a lista está agrupada e mostra os canais em vez das linhas.
  channels?: ChannelGroup[];
  // Chaves dos canais abertos: os itens de cada um entram logo abaixo dele, na
  // própria lista (sanfona — vários podem estar abertos).
  openChannels?: ReadonlySet<string>;
  onToggleChannel: (key: string) => void;
  // Presente = o bloco de playlists está ligado: elas entram no topo da lista,
  // em sanfona, e os itens (ou canais) continuam embaixo.
  playlists?: PlaylistGroup[];
  openPlaylists?: ReadonlySet<string>;
  onTogglePlaylist?: (id: string) => void;
  // Aviso no lugar do bloco quando a aba ainda não tem playlist.
  playlistsHint?: string;
  // A playlist de onde o item atual está tocando. Com ela o destaque fica na
  // linha de dentro da playlist, não na lista de baixo — o mesmo item aparece
  // nos dois lugares.
  activePlaylistId?: string;
  onRemoveFromPlaylist?: (playlistId: string, entry: YoutubeLibraryEntry) => void;
  onRenamePlaylist?: (playlistId: string, name: string) => void;
  onDeletePlaylist?: (playlistId: string) => void;
  // Ordem aleatória: só existe tocando de dentro de uma playlist.
  shuffle?: boolean;
  onShuffleChange?: (value: boolean) => void;
  // O menu "Playlists" do item atual, abaixo do player.
  itemPlaylists?: {
    playlists: YoutubePlaylist[];
    onAdd: (playlistId: string) => void;
    onRemove: (playlistId: string) => void;
    onCreate: (name: string) => void;
    disabled?: boolean;
  };
  // Presente = modo de seleção: clicar numa linha marca em vez de tocar.
  selection?: ReadonlySet<string>;
  // `siblings` é a lista em que a linha está — é nela que o Shift marca intervalo.
  onToggleSelect?: (entry: YoutubeLibraryEntry, shiftKey: boolean, siblings: YoutubeLibraryEntry[]) => void;
  onSelectGroup?: (entries: YoutubeLibraryEntry[]) => void;
  autoplay: boolean;
  onAutoplayChange: (value: boolean) => void;
  // `playlistId` vem quando a escolha foi feita de dentro de uma playlist.
  onSelect: (videoId: string, playlistId?: string) => void;
  // Tocar o item é o que conta como acesso (a página abre num item pausado, e
  // abrir sem tocar não é assistir).
  onPlayed?: () => void;
  onEdit: () => void;
  // Manda o item para a outra aba.
  onMove: (entry: YoutubeLibraryEntry) => void;
  onNotesChange: (notes: string) => void;
  // Busca, ordenação e abas de status, acima da lista.
  controls?: ReactNode;
  // Abaixo da lista: a barra de seleção.
  footer?: ReactNode;
}

const KIND_TABS = (Object.entries(YOUTUBE_KIND_LABELS) as [YoutubeKind, string][]).map(([id, label]) => ({
  id,
  label,
}));

const NO_OPEN_GROUPS: ReadonlySet<string> = new Set();
const OFFLINE_HINT = "Sem conexão — não dá para alterar agora.";

const KIND_NOUNS: Record<YoutubeKind, [string, string]> = {
  music: ["música", "músicas"],
  video: ["vídeo", "vídeos"],
};

// Canal e playlist são a mesma sanfona; isto é o que muda de um para o outro.
interface GroupRow {
  key: string;
  name: string;
  tracks: YoutubeLibraryEntry[];
  open: boolean;
  // O item atual está tocando daqui de dentro.
  holdsCurrent: boolean;
  cover: ReactNode;
  onToggle: () => void;
  // Só nas playlists: as linhas de dentro tocam e destacam no contexto dela.
  playlistId?: string;
  // Entre o cabeçalho e os itens do grupo aberto.
  actions?: ReactNode;
  emptyMessage?: string;
}

function countLabel(count: number, kind: YoutubeKind): string {
  const [one, many] = KIND_NOUNS[kind];
  return `${count} ${count === 1 ? one : many}`;
}

function statsLine(entry: YoutubeLibraryEntry): string {
  const parts = [formatViews(entry.viewCount)];
  if (entry.publishedAt) parts.push(formatLastAccess(entry.publishedAt));
  return parts.join(" · ");
}

function moveLabel(entry: YoutubeLibraryEntry): string {
  return `Mover para ${YOUTUBE_KIND_LABELS[otherKind(entry.kind)]}`;
}

// "Playlists · 2": em quantas o item atual está.
function playlistsLabel(playlists: YoutubePlaylist[], entryId: string): string {
  const count = playlists.filter((playlist) => playlist.itemIds.includes(entryId)).length;
  return count > 0 ? `Playlists · ${count}` : "Playlists";
}

export function YoutubeWatch({
  entry,
  kind,
  onKindChange,
  tracks,
  playOrder,
  channels,
  openChannels = NO_OPEN_GROUPS,
  onToggleChannel,
  playlists,
  openPlaylists = NO_OPEN_GROUPS,
  onTogglePlaylist,
  playlistsHint,
  activePlaylistId,
  onRemoveFromPlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
  shuffle = false,
  onShuffleChange,
  itemPlaylists,
  selection,
  onToggleSelect,
  onSelectGroup,
  autoplay,
  onAutoplayChange,
  onSelect,
  onPlayed,
  onEdit,
  onMove,
  onNotesChange,
  controls,
  footer,
}: YoutubeWatchProps) {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const playedId = useRef<string | null>(null);
  // Guardado junto com o item a que pertence: trocar de item recolhe a
  // descrição por derivação.
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const expanded = expandedFor === entry.id;
  // No celular a descrição e a anotação ficam recolhidas até alguém pedir (o
  // CSS só as esconde lá). Vale para a visita, não por item.
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { previous, next } = trackNeighbors(playOrder, entry.videoId);

  // Fora de playlist a chamada sai com um argumento só: quem escuta não precisa
  // distinguir "sem playlist" de um `undefined` explícito.
  const select = (videoId: string, playlistId?: string) => {
    if (playlistId) onSelect(videoId, playlistId);
    else onSelect(videoId);
  };

  // Em tela estreita a lista fica abaixo do player: escolher nela deve trazer o
  // vídeo de volta para a vista. Só rola se o player já saiu por cima — no
  // celular ele é fixo e nunca sai, então a rolagem fica onde está (e no desktop,
  // com o player à vista, rolar esconderia a barra de adicionar).
  useEffect(() => {
    const top = stage.current?.getBoundingClientRect().top ?? 0;
    if (top < -1) root.current?.scrollIntoView?.({ block: "start" });
  }, [entry.id]);

  // A lista tem rolagem própria no desktop: quando a reprodução automática
  // avança para um item fora da parte visível, o destaque tem que aparecer.
  // Ajusta o scrollTop da lista em vez de usar scrollIntoView, que rolaria a
  // página junto. Abrir ou fechar um canal ou playlist não entra aqui: puxaria a
  // lista de volta para o item atual a cada toque.
  useEffect(() => {
    const container = list.current;
    const row = container?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!container || !row) return;
    const box = container.getBoundingClientRect();
    const rect = row.getBoundingClientRect();
    if (rect.top < box.top) container.scrollTop -= box.top - rect.top;
    else if (rect.bottom > box.bottom) container.scrollTop += rect.bottom - box.bottom;
  }, [entry.id, tracks, channels, activePlaylistId]);

  const emptyMessage = `Nenhum${kind === "music" ? "a" : ""} ${KIND_NOUNS[kind][0]} nesta lista.`;

  // `playlistId` = a linha está dentro dessa playlist. O mesmo item pode estar
  // em várias listas da tela; só a do contexto que está tocando leva o destaque.
  const trackRow = (track: YoutubeLibraryEntry, siblings: YoutubeLibraryEntry[], playlistId?: string) => {
    const current = track.id === entry.id && playlistId === activePlaylistId;
    const picked = selection?.has(track.id) ?? false;
    return (
      <li key={track.id} className={styles.rowItem}>
        <button
          type="button"
          className={`${styles.row} ${current ? styles.rowCurrent : ""} ${picked ? styles.rowPicked : ""}`}
          aria-current={current ? "true" : undefined}
          aria-pressed={selection ? picked : undefined}
          onClick={(event) => {
            if (selection) onToggleSelect?.(track, event.shiftKey, siblings);
            else if (!current) select(track.videoId, playlistId);
          }}
        >
          <div className={styles.thumb}>
            <CoverImage
              className={styles.thumbImage}
              src={track.thumbnail}
              alt=""
              fallback={<div className={styles.thumbPlaceholder}>▶</div>}
            />
            {selection ? (
              <span className={`${styles.check} ${picked ? styles.checkOn : ""}`} aria-hidden="true">
                {picked ? "✓" : ""}
              </span>
            ) : (
              current && (
                <span className={styles.nowBadge} title="Item atual" aria-label="Item atual">
                  ▶
                </span>
              )
            )}
            <span className={styles.duration}>{formatDuration(track.durationSeconds)}</span>
          </div>
          <div className={styles.rowText}>
            <div className={styles.rowTitle} title={track.title}>{track.title}</div>
            {track.channelTitle && <div className={styles.rowChannel}>{track.channelTitle}</div>}
            <div className={styles.rowStats}>{statsLine(track)}</div>
          </div>
        </button>
        {/* Irmão da linha, não filho: botão dentro de botão é HTML inválido.
            Dentro de uma playlist a ação da linha é tirá-la dali; fora, mover de
            aba. Em modo de seleção a linha só marca. */}
        {!selection &&
          (playlistId ? (
            <button
              type="button"
              className={styles.move}
              onClick={() => onRemoveFromPlaylist?.(playlistId, track)}
              title="Tirar da playlist"
              aria-label={`Tirar da playlist: ${track.title}`}
            >
              ✕ Tirar
            </button>
          ) : (
            <button
              type="button"
              className={styles.move}
              onClick={() => onMove(track)}
              title={moveLabel(track)}
              aria-label={`${moveLabel(track)}: ${track.title}`}
            >
              → {YOUTUBE_KIND_LABELS[otherKind(track.kind)]}
            </button>
          ))}
      </li>
    );
  };

  const groupRow = (group: GroupRow) => {
    // Aberto, quem leva o destaque é o item dentro dele.
    const playing = !group.open && group.holdsCurrent;
    const allPicked =
      !!selection && group.tracks.length > 0 && group.tracks.every((track) => selection.has(track.id));
    return (
      <li key={group.key} className={group.open ? styles.groupOpen : undefined}>
        <div className={styles.groupHead}>
          {selection && group.tracks.length > 0 && (
            <button
              type="button"
              className={styles.groupSelect}
              aria-pressed={allPicked}
              aria-label={`Selecionar tudo: ${group.name}`}
              title="Selecionar tudo"
              onClick={() => onSelectGroup?.(group.tracks)}
            >
              <span className={`${styles.check} ${allPicked ? styles.checkOn : ""}`} aria-hidden="true">
                {allPicked ? "✓" : ""}
              </span>
            </button>
          )}
          <button
            type="button"
            className={`${styles.channelRow} ${playing ? styles.rowCurrent : ""}`}
            aria-current={playing ? "true" : undefined}
            aria-expanded={group.open}
            onClick={group.onToggle}
          >
            {group.cover}
            <span className={styles.channelRowText}>
              <span className={styles.rowTitle} title={group.name}>{group.name}</span>
              <span className={styles.rowStats}>{countLabel(group.tracks.length, kind)}</span>
            </span>
            <span className={`${styles.chevron} ${group.open ? styles.chevronOpen : ""}`} aria-hidden="true">›</span>
          </button>
        </div>
        {group.open && (
          <>
            {group.actions}
            {group.tracks.length > 0 ? (
              <ul className={styles.members} aria-label={group.name}>
                {group.tracks.map((track) => trackRow(track, group.tracks, group.playlistId))}
              </ul>
            ) : (
              group.emptyMessage && <div className={styles.groupEmpty}>{group.emptyMessage}</div>
            )}
          </>
        )}
      </li>
    );
  };

  const channelRow = (channel: ChannelGroup) =>
    groupRow({
      key: channel.key,
      name: channel.name,
      tracks: channel.tracks,
      open: openChannels.has(channel.key),
      // Tocando de dentro de uma playlist, o destaque é dela, não do canal.
      holdsCurrent: !activePlaylistId && channel.tracks.some((track) => track.id === entry.id),
      onToggle: () => onToggleChannel(channel.key),
      cover: (
        <CoverImage
          className={styles.channelAvatar}
          src={channel.thumbnail}
          alt=""
          fallback={<div className={styles.channelAvatarPlaceholder}>▶</div>}
        />
      ),
    });

  const playlistRow = (playlist: PlaylistGroup) =>
    groupRow({
      key: playlist.id,
      name: playlist.name,
      tracks: playlist.tracks,
      open: openPlaylists.has(playlist.id),
      holdsCurrent: activePlaylistId === playlist.id,
      onToggle: () => onTogglePlaylist?.(playlist.id),
      playlistId: playlist.id,
      emptyMessage: "Playlist vazia.",
      cover: (
        <CoverImage
          className={styles.playlistCover}
          src={playlist.tracks[0]?.thumbnail ?? null}
          alt=""
          fallback={<div className={styles.playlistCoverPlaceholder}>♫</div>}
        />
      ),
      actions: onRenamePlaylist && onDeletePlaylist && !selection && (
        <YoutubePlaylistActions
          name={playlist.name}
          takenNames={(playlists ?? []).filter((other) => other.id !== playlist.id).map((other) => other.name)}
          onRename={(name) => onRenamePlaylist(playlist.id, name)}
          onDelete={() => onDeletePlaylist(playlist.id)}
        />
      ),
    });

  const listEmpty = (channels ?? tracks).length === 0;
  const playlistBlock = playlists !== undefined && (playlists.length > 0 || !!playlistsHint);
  // O que a aba tem na lista de baixo, em qualquer modo — as playlists do topo
  // repetem itens dela e não entram na conta.
  const listCount = channels ? channels.reduce((total, channel) => total + channel.tracks.length, 0) : tracks.length;

  return (
    <div className={styles.watch} ref={root}>
      <div className={styles.main}>
        {/* Invólucro do player: é ele que fica fixo no topo no celular. */}
        <div className={styles.stageSlot} ref={stage}>
          <YoutubePlayer
            videoId={entry.videoId}
            thumbnail={entry.thumbnail}
            onEnded={() => {
              if (autoplay && next) select(next.videoId, activePlaylistId);
            }}
            onPlaying={() => {
              // Uma vez por item: pausar e retomar não é assistir de novo.
              if (playedId.current === entry.id) return;
              playedId.current = entry.id;
              onPlayed?.();
            }}
          />
        </div>

        <h2 className={styles.title}>{entry.title}</h2>

        <div className={styles.metaRow}>
          <div className={styles.channel}>
            <CoverImage
              className={styles.avatar}
              src={entry.channelThumbnail}
              alt=""
              eager
              fallback={<div className={styles.avatarPlaceholder}>▶</div>}
            />
            <span className={styles.channelName}>{entry.channelTitle ?? "Canal desconhecido"}</span>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.action}
              onClick={() => previous && select(previous.videoId, activePlaylistId)}
              disabled={!previous}
              aria-label="Item anterior"
              title="Anterior"
            >
              ⏮
            </button>
            <button
              type="button"
              className={styles.action}
              onClick={() => next && select(next.videoId, activePlaylistId)}
              disabled={!next}
              aria-label="Próximo item"
              title="Próximo"
            >
              ⏭
            </button>
            <button
              type="button"
              className={`${styles.action} ${autoplay ? styles.actionOn : ""}`}
              onClick={() => onAutoplayChange(!autoplay)}
              aria-pressed={autoplay}
              aria-label="Reprodução automática"
              title={autoplay ? "Reprodução automática ligada" : "Reprodução automática desligada"}
            >
              Auto
            </button>
            {/* Só tocando de dentro de uma playlist: é ela que é embaralhada. */}
            {activePlaylistId && onShuffleChange && (
              <button
                type="button"
                className={`${styles.action} ${shuffle ? styles.actionOn : ""}`}
                onClick={() => onShuffleChange(!shuffle)}
                aria-pressed={shuffle}
                aria-label="Ordem aleatória"
                title={shuffle ? "Ordem aleatória ligada" : "Tocar a playlist em ordem aleatória"}
              >
                Aleatório
              </button>
            )}
            <button type="button" className={styles.action} onClick={onEdit} title="Status e nota">
              {YOUTUBE_LIBRARY_STATUS_LABELS[entry.status]}
              {entry.score > 0 && ` · ⭐ ${entry.score.toFixed(1)}`}
            </button>
            {itemPlaylists && (
              <YoutubePlaylistPicker
                single
                label={playlistsLabel(itemPlaylists.playlists, entry.id)}
                buttonClassName={styles.action}
                playlists={itemPlaylists.playlists}
                entryIds={[entry.id]}
                onAdd={itemPlaylists.onAdd}
                onRemove={itemPlaylists.onRemove}
                onCreate={itemPlaylists.onCreate}
                disabled={itemPlaylists.disabled}
                disabledHint={OFFLINE_HINT}
              />
            )}
            <button type="button" className={styles.action} onClick={() => onMove(entry)}>
              {moveLabel(entry)}
            </button>
            <a
              className={styles.action}
              href={`https://www.youtube.com/watch?v=${entry.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir no YouTube ↗
            </a>
          </div>
        </div>

        <button
          type="button"
          className={styles.detailsToggle}
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          {detailsOpen ? "Ocultar detalhes" : "Mostrar detalhes"}
        </button>

        <div className={`${styles.details} ${detailsOpen ? "" : styles.detailsCollapsed}`}>
          <div className={styles.infoBox}>
            <div className={styles.stats}>
              {statsLine(entry)} · {formatDuration(entry.durationSeconds)}
            </div>
            {entry.description && (
              <>
                <div className={`${styles.description} ${expanded ? "" : styles.descriptionClamped}`}>
                  {entry.description}
                </div>
                <button
                  type="button"
                  className={styles.more}
                  onClick={() => setExpandedFor(expanded ? null : entry.id)}
                >
                  {expanded ? "Mostrar menos" : "Mostrar mais"}
                </button>
              </>
            )}
          </div>

          {/* key por item: o NotesBlock guarda o texto em estado interno e a
              anotação de um vazaria para o seguinte. */}
          <NotesBlock key={entry.id} value={entry.notes} onSave={onNotesChange} />
        </div>
      </div>

      <aside className={styles.queue} aria-label="Biblioteca">
        <div className={styles.queueHeader}>
          <TabNav plain tabs={KIND_TABS} activeTab={kind} onTabChange={(id) => onKindChange(id as YoutubeKind)} />
          <span className={styles.queueCount}>{countLabel(listCount, kind)}</span>
        </div>

        {controls}

        {listEmpty && !playlistBlock ? (
          <div className={styles.queueEmpty}>{emptyMessage}</div>
        ) : (
          <ul className={styles.queueList} ref={list}>
            {playlists?.map(playlistRow)}
            {playlists?.length === 0 && playlistsHint && <li className={styles.listNote}>{playlistsHint}</li>}
            {playlistBlock && <li className={styles.divider} role="separator" />}
            {listEmpty && <li className={styles.listNote}>{emptyMessage}</li>}
            {channels ? channels.map(channelRow) : tracks.map((track) => trackRow(track, tracks))}
          </ul>
        )}

        {footer}
      </aside>
    </div>
  );
}
