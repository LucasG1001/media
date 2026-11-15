import { useEffect, useRef, useState, type ReactNode } from "react";
import type { YoutubeKind, YoutubeLibraryEntry } from "../../types/youtubeLibrary";
import { YOUTUBE_KIND_LABELS, YOUTUBE_LIBRARY_STATUS_LABELS, otherKind } from "../../types/youtubeLibrary";
import { YoutubePlayer } from "../YoutubePlayer/YoutubePlayer";
import { CoverImage } from "../CoverImage/CoverImage";
import { NotesBlock } from "../NotesBlock/NotesBlock";
import { TabNav } from "../TabNav/TabNav";
import { formatDuration } from "../../utils/formatDuration";
import { formatViews } from "../../utils/formatViews";
import { formatLastAccess } from "../../utils/lastAccess";
import { trackNeighbors, type ChannelGroup } from "../../utils/youtubeList";
import styles from "./YoutubeWatch.module.css";

interface YoutubeWatchProps {
  entry: YoutubeLibraryEntry;
  // A aba do painel: músicas ou vídeos.
  kind: YoutubeKind;
  onKindChange: (kind: YoutubeKind) => void;
  // As linhas da lista, na ordem em que estão na tela. A lista não muda com o
  // item que toca: o atual só é destacado no lugar em que já estava.
  tracks: YoutubeLibraryEntry[];
  // De onde saem anterior/próximo e a reprodução automática. É a própria lista,
  // menos quando ela está agrupada por canal sem nenhum canal aberto.
  playOrder: YoutubeLibraryEntry[];
  // Presente = a lista está agrupada e mostra os canais em vez das linhas.
  channels?: ChannelGroup[];
  // Canal aberto: a lista mostra só os itens dele, com a barra de saída.
  openChannel?: ChannelGroup;
  onOpenChannel: (key: string) => void;
  onCloseChannel: () => void;
  autoplay: boolean;
  onAutoplayChange: (value: boolean) => void;
  onSelect: (videoId: string) => void;
  // Tocar o item é o que conta como acesso (a página abre num item pausado, e
  // abrir sem tocar não é assistir).
  onPlayed?: () => void;
  onEdit: () => void;
  // Manda o item para a outra aba.
  onMove: (entry: YoutubeLibraryEntry) => void;
  onNotesChange: (notes: string) => void;
  // Busca, ordenação e abas de status, acima da lista.
  controls?: ReactNode;
}

const KIND_TABS = (Object.entries(YOUTUBE_KIND_LABELS) as [YoutubeKind, string][]).map(([id, label]) => ({
  id,
  label,
}));

const KIND_NOUNS: Record<YoutubeKind, [string, string]> = {
  music: ["música", "músicas"],
  video: ["vídeo", "vídeos"],
};

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

export function YoutubeWatch({
  entry,
  kind,
  onKindChange,
  tracks,
  playOrder,
  channels,
  openChannel,
  onOpenChannel,
  onCloseChannel,
  autoplay,
  onAutoplayChange,
  onSelect,
  onPlayed,
  onEdit,
  onMove,
  onNotesChange,
  controls,
}: YoutubeWatchProps) {
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const playedId = useRef<string | null>(null);
  // Guardado junto com o item a que pertence: trocar de item recolhe a
  // descrição por derivação.
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const expanded = expandedFor === entry.id;

  const { previous, next } = trackNeighbors(playOrder, entry.videoId);
  const showingChannels = channels !== undefined && !openChannel;

  // No celular a lista fica abaixo do player: escolher nela deve trazer o vídeo
  // de volta para a vista. Só rola se o topo já saiu da tela — com o player à
  // vista (o caso do desktop) rolar esconderia a barra de adicionar.
  useEffect(() => {
    const element = root.current;
    if (element && element.getBoundingClientRect().top < 0) element.scrollIntoView?.({ block: "start" });
  }, [entry.id]);

  // A lista tem rolagem própria no desktop: quando a reprodução automática
  // avança para um item fora da parte visível, o destaque tem que aparecer.
  // Ajusta o scrollTop da lista em vez de usar scrollIntoView, que rolaria a
  // página junto.
  useEffect(() => {
    const container = list.current;
    const row = container?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!container || !row) return;
    const box = container.getBoundingClientRect();
    const rect = row.getBoundingClientRect();
    if (rect.top < box.top) container.scrollTop -= box.top - rect.top;
    else if (rect.bottom > box.bottom) container.scrollTop += rect.bottom - box.bottom;
  }, [entry.id, tracks, showingChannels]);

  const emptyMessage = `Nenhum${kind === "music" ? "a" : ""} ${KIND_NOUNS[kind][0]} nesta lista.`;

  return (
    <div className={styles.watch} ref={root}>
      <div className={styles.main}>
        <YoutubePlayer
          videoId={entry.videoId}
          thumbnail={entry.thumbnail}
          onEnded={() => {
            if (autoplay && next) onSelect(next.videoId);
          }}
          onPlaying={() => {
            // Uma vez por item: pausar e retomar não é assistir de novo.
            if (playedId.current === entry.id) return;
            playedId.current = entry.id;
            onPlayed?.();
          }}
        />

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
              onClick={() => previous && onSelect(previous.videoId)}
              disabled={!previous}
              aria-label="Item anterior"
              title="Anterior"
            >
              ⏮
            </button>
            <button
              type="button"
              className={styles.action}
              onClick={() => next && onSelect(next.videoId)}
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
            <button type="button" className={styles.action} onClick={onEdit} title="Status e nota">
              {YOUTUBE_LIBRARY_STATUS_LABELS[entry.status]}
              {entry.score > 0 && ` · ⭐ ${entry.score.toFixed(1)}`}
            </button>
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

      <aside className={styles.queue} aria-label="Biblioteca">
        <div className={styles.queueHeader}>
          <TabNav plain tabs={KIND_TABS} activeTab={kind} onTabChange={(id) => onKindChange(id as YoutubeKind)} />
          {/* O que a lista tem agora, em qualquer modo: é a ordem de reprodução. */}
          <span className={styles.queueCount}>{countLabel(playOrder.length, kind)}</span>
        </div>

        {controls}

        {openChannel && (
          <div className={styles.channelBar}>
            <button type="button" className={styles.exit} onClick={onCloseChannel}>
              ← Todos os canais
            </button>
            <span className={styles.channelBarName} title={openChannel.name}>
              {openChannel.name}
            </span>
          </div>
        )}

        {showingChannels ? (
          channels.length === 0 ? (
            <div className={styles.queueEmpty}>{emptyMessage}</div>
          ) : (
            <ul className={styles.queueList} ref={list}>
              {channels.map((channel) => {
                const playing = channel.tracks.some((track) => track.id === entry.id);
                return (
                  <li key={channel.key}>
                    <button
                      type="button"
                      className={`${styles.channelRow} ${playing ? styles.rowCurrent : ""}`}
                      aria-current={playing ? "true" : undefined}
                      onClick={() => onOpenChannel(channel.key)}
                    >
                      <CoverImage
                        className={styles.channelAvatar}
                        src={channel.thumbnail}
                        alt=""
                        fallback={<div className={styles.channelAvatarPlaceholder}>▶</div>}
                      />
                      <span className={styles.channelRowText}>
                        <span className={styles.rowTitle} title={channel.name}>{channel.name}</span>
                        <span className={styles.rowStats}>{countLabel(channel.tracks.length, kind)}</span>
                      </span>
                      <span className={styles.chevron} aria-hidden="true">›</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : tracks.length === 0 ? (
          <div className={styles.queueEmpty}>{emptyMessage}</div>
        ) : (
          <ul className={styles.queueList} ref={list}>
            {tracks.map((track) => {
              const current = track.id === entry.id;
              return (
                <li key={track.id} className={styles.rowItem}>
                  <button
                    type="button"
                    className={`${styles.row} ${current ? styles.rowCurrent : ""}`}
                    aria-current={current ? "true" : undefined}
                    onClick={() => {
                      if (!current) onSelect(track.videoId);
                    }}
                  >
                    <div className={styles.thumb}>
                      <CoverImage
                        className={styles.thumbImage}
                        src={track.thumbnail}
                        alt=""
                        fallback={<div className={styles.thumbPlaceholder}>▶</div>}
                      />
                      {current && (
                        <span className={styles.nowBadge} title="Item atual" aria-label="Item atual">
                          ▶
                        </span>
                      )}
                      <span className={styles.duration}>{formatDuration(track.durationSeconds)}</span>
                    </div>
                    <div className={styles.rowText}>
                      <div className={styles.rowTitle} title={track.title}>{track.title}</div>
                      {track.channelTitle && <div className={styles.rowChannel}>{track.channelTitle}</div>}
                      <div className={styles.rowStats}>{statsLine(track)}</div>
                    </div>
                  </button>
                  {/* Irmão da linha, não filho: botão dentro de botão é HTML inválido. */}
                  <button
                    type="button"
                    className={styles.move}
                    onClick={() => onMove(track)}
                    title={moveLabel(track)}
                    aria-label={`${moveLabel(track)}: ${track.title}`}
                  >
                    → {YOUTUBE_KIND_LABELS[otherKind(track.kind)]}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}
