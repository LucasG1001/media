import { useEffect, useRef } from "react";
import type { YoutubeLibraryEntry } from "../../types/youtubeLibrary";
import { YOUTUBE_LIBRARY_STATUS_LABELS } from "../../types/youtubeLibrary";
import { TrailerEmbed } from "../TrailerEmbed/TrailerEmbed";
import { DrawerNav, type DrawerNavProps } from "../DrawerNav/DrawerNav";
import { useDrawerKeys } from "../../hooks/useDrawerKeys";
import { NotesBlock } from "../NotesBlock/NotesBlock";
import { formatDuration } from "../../utils/formatDuration";
import { formatViews } from "../../utils/formatViews";
import styles from "./YoutubeDrawer.module.css";
import { CoverImage } from "../CoverImage/CoverImage";

interface YoutubeDrawerProps {
  entry: YoutubeLibraryEntry;
  onClose: () => void;
  // Abrir o drawer é o que conta como acesso no YouTube.
  onOpen?: () => void;
  onNotesChange?: (notes: string) => void;
  // Navegação dentro da coleção, sem fechar o drawer. Ausente em vídeo avulso.
  nav?: DrawerNavProps;
}

function formatPublished(date: string | null): string {
  if (!date) return "N/A";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function YoutubeDrawer({ entry, onClose, onOpen, onNotesChange, nav }: YoutubeDrawerProps) {
  useDrawerKeys(onClose, nav);

  // Por vídeo, não por montagem: o drawer NÃO é mais remontado ao navegar (é o
  // que preserva a tela cheia), então quem marca "abriu" é a troca de id. O
  // callback vai por ref porque é arrow inline na página e mudaria a cada render.
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  });
  useEffect(() => {
    onOpenRef.current?.();
  }, [entry.id]);

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.drawer}>
        <button className={styles.closeButton} onClick={onClose} title="Fechar (Esc)">✕</button>

        <CoverImage
          className={styles.banner}
          src={entry.thumbnail}
          alt=""
          eager
          fallback={<div className={styles.bannerPlaceholder} />}
        />

        <div className={styles.header}>
          <CoverImage
            className={styles.channelAvatar}
            src={entry.channelThumbnail}
            alt={entry.channelTitle ?? ""}
            eager
            fallback={<div className={styles.channelAvatarPlaceholder}>▶️</div>}
          />
          <div className={styles.headerText}>
            <div className={styles.title}>{entry.title}</div>
            {entry.channelTitle && <div className={styles.channel}>{entry.channelTitle}</div>}
          </div>
        </div>

        <div className={styles.content}>
          <TrailerEmbed
            youtubeId={entry.videoId}
            overlay={nav && <DrawerNav {...nav} variant="float" />}
            autoPlay
          />

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
          </div>

          {entry.score > 0 && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Sua nota</span>
              <span className={styles.infoValue}>⭐ {entry.score.toFixed(1)}</span>
            </div>
          )}

          {entry.description && <div className={styles.description}>{entry.description}</div>}

          {onNotesChange && (
            // key por vídeo: o NotesBlock guarda o texto em estado interno e
            // descarrega o pendente ao desmontar. Sem isto, navegar levaria a
            // anotação de um vídeo para o outro.
            <NotesBlock key={entry.id} value={entry.notes} onSave={onNotesChange} />
          )}
        </div>
      </div>
    </>
  );
}
