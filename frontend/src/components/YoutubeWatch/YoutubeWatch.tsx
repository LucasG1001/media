import { useEffect, useRef, useState, type ReactNode } from "react";
import type { MusicLibraryEntry } from "../../types/musicLibrary";
import { MUSIC_LIBRARY_STATUS_LABELS } from "../../types/musicLibrary";
import { YoutubePlayer } from "../YoutubePlayer/YoutubePlayer";
import { CoverImage } from "../CoverImage/CoverImage";
import { NotesBlock } from "../NotesBlock/NotesBlock";
import { formatDuration } from "../../utils/formatDuration";
import { formatViews } from "../../utils/formatViews";
import { formatLastAccess } from "../../utils/lastAccess";
import { trackNeighbors } from "../../utils/musicList";
import styles from "./MusicWatch.module.css";

interface MusicWatchProps {
  entry: MusicLibraryEntry;
  // A lista da direita, na ordem em que está na tela. Ela não muda com a música
  // que toca: a atual só é destacada no lugar em que já estava.
  tracks: MusicLibraryEntry[];
  autoplay: boolean;
  onAutoplayChange: (value: boolean) => void;
  onSelect: (videoId: string) => void;
  // Tocar a música é o que conta como acesso (a página abre numa música
  // pausada, e abrir sem tocar não é ouvir).
  onPlayed?: () => void;
  onEdit: () => void;
  onNotesChange: (notes: string) => void;
  // Busca, ordenação e abas, acima da lista.
  controls?: ReactNode;
}

function statsLine(entry: MusicLibraryEntry): string {
  const parts = [formatViews(entry.viewCount)];
  if (entry.publishedAt) parts.push(formatLastAccess(entry.publishedAt));
  return parts.join(" · ");
}

export function MusicWatch({
  entry,
  tracks,
  autoplay,
  onAutoplayChange,
  onSelect,
  onPlayed,
  onEdit,
  onNotesChange,
  controls,
}: MusicWatchProps) {
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const playedId = useRef<string | null>(null);
  // Guardado junto com a música a que pertence: trocar de música recolhe a
  // descrição por derivação.
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const expanded = expandedFor === entry.id;

  const { previous, next } = trackNeighbors(tracks, entry.videoId);

  // No celular a lista fica abaixo do player: escolher nela deve trazer o vídeo
  // de volta para a vista. Só rola se o topo já saiu da tela — com o player à
  // vista (o caso do desktop) rolar esconderia a barra de adicionar.
  useEffect(() => {
    const element = root.current;
    if (element && element.getBoundingClientRect().top < 0) element.scrollIntoView?.({ block: "start" });
  }, [entry.id]);

  // A lista tem rolagem própria no desktop: quando a reprodução automática
  // avança para uma música fora da parte visível, o destaque tem que aparecer.
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
  }, [entry.id, tracks]);

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
            // Uma vez por música: pausar e retomar não é ouvir de novo.
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
              fallback={<div className={styles.avatarPlaceholder}>🎵</div>}
            />
            <span className={styles.channelName}>{entry.channelTitle ?? "Canal desconhecido"}</span>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.action}
              onClick={() => previous && onSelect(previous.videoId)}
              disabled={!previous}
              aria-label="Música anterior"
              title="Música anterior"
            >
              ⏮
            </button>
            <button
              type="button"
              className={styles.action}
              onClick={() => next && onSelect(next.videoId)}
              disabled={!next}
              aria-label="Próxima música"
              title="Próxima música"
            >
              ⏭
            </button>
            <button type="button" className={styles.action} onClick={onEdit} title="Status e nota">
              {MUSIC_LIBRARY_STATUS_LABELS[entry.status]}
              {entry.score > 0 && ` · ⭐ ${entry.score.toFixed(1)}`}
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

        {/* key por música: o NotesBlock guarda o texto em estado interno e a
            anotação de uma vazaria para a seguinte. */}
        <NotesBlock key={entry.id} value={entry.notes} onSave={onNotesChange} />
      </div>

      <aside className={styles.queue} aria-label="Músicas">
        <div className={styles.queueHeader}>
          <div className={styles.queueTitle}>
            Músicas <span className={styles.queueCount}>{tracks.length}</span>
          </div>
          <label className={styles.autoplay}>
            <input
              type="checkbox"
              checked={autoplay}
              onChange={(event) => onAutoplayChange(event.target.checked)}
            />
            Reprodução automática
          </label>
        </div>

        {controls}

        {tracks.length === 0 ? (
          <div className={styles.queueEmpty}>Nenhuma música nesta lista.</div>
        ) : (
          <ul className={styles.queueList} ref={list}>
            {tracks.map((track) => {
              const current = track.id === entry.id;
              return (
                <li key={track.id}>
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
                        fallback={<div className={styles.thumbPlaceholder}>🎵</div>}
                      />
                      {current && (
                        <span className={styles.nowBadge} title="Música atual" aria-label="Música atual">
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
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}
