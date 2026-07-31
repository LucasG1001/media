import { useEffect, useCallback, useState } from "react";
import type { YoutubeLibraryEntry } from "../../types/youtubeLibrary";
import { YOUTUBE_LIBRARY_STATUS_LABELS } from "../../types/youtubeLibrary";
import { TrailerEmbed } from "../TrailerEmbed/TrailerEmbed";
import { NotesBlock } from "../NotesBlock/NotesBlock";
import { formatDuration } from "../../utils/formatDuration";
import { formatViews } from "../../utils/formatViews";
import { formatLastAccess, formatLastAccessExact } from "../../utils/lastAccess";
import styles from "./YoutubeDrawer.module.css";

interface YoutubeDrawerProps {
  entry: YoutubeLibraryEntry;
  onClose: () => void;
  // Abrir o drawer é o que conta como acesso no YouTube.
  onOpen?: () => void;
  onNotesChange?: (notes: string) => void;
}

function formatPublished(date: string | null): string {
  if (!date) return "N/A";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function YoutubeDrawer({ entry, onClose, onOpen, onNotesChange }: YoutubeDrawerProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  // Mostra o acesso ANTERIOR: registrar o de agora deixaria "hoje" na tela
  // justamente quando interessa saber há quanto tempo não se via o vídeo. Vale
  // porque a página remonta o drawer por vídeo (key), então montar = abrir.
  const [previousAccess] = useState(entry.lastAccessAt);

  // Efeito só de montagem: o de cima re-roda a cada render (onClose é arrow
  // inline na página) e registraria o acesso repetidamente.
  useEffect(() => {
    onOpen?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.drawer}>
        <button className={styles.closeButton} onClick={onClose}>✕</button>

        {entry.thumbnail ? (
          <img className={styles.banner} src={entry.thumbnail} alt="" />
        ) : (
          <div className={styles.bannerPlaceholder} />
        )}

        <div className={styles.header}>
          {entry.channelThumbnail ? (
            <img className={styles.channelAvatar} src={entry.channelThumbnail} alt={entry.channelTitle ?? ""} />
          ) : (
            <div className={styles.channelAvatarPlaceholder}>▶️</div>
          )}
          <div className={styles.headerText}>
            <div className={styles.title}>{entry.title}</div>
            {entry.channelTitle && <div className={styles.channel}>{entry.channelTitle}</div>}
          </div>
        </div>

        <div className={styles.content}>
          <TrailerEmbed youtubeId={entry.videoId} />

          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Status</span>
              <span className={styles.infoValue}>{YOUTUBE_LIBRARY_STATUS_LABELS[entry.status]}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Duração</span>
              <span className={styles.infoValue}>{formatDuration(entry.durationSeconds)}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Visualizações</span>
              <span className={styles.infoValue}>{formatViews(entry.viewCount)}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Publicado</span>
              <span className={styles.infoValue}>{formatPublished(entry.publishedAt)}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Último acesso</span>
              <span
                className={styles.infoValue}
                title={previousAccess ? formatLastAccessExact(previousAccess) : undefined}
              >
                {previousAccess ? formatLastAccess(previousAccess) : "—"}
              </span>
            </div>
          </div>

          {entry.score > 0 && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Sua nota</span>
              <span className={styles.infoValue}>⭐ {entry.score.toFixed(1)}</span>
            </div>
          )}

          {entry.description && <div className={styles.description}>{entry.description}</div>}

          {onNotesChange && <NotesBlock value={entry.notes} onSave={onNotesChange} />}
        </div>
      </div>
    </>
  );
}
