import { useRef, type ReactNode, type MouseEvent } from "react";
import { useLongPress } from "../../hooks/useLongPress";
import {
  formatLastAccess,
  formatLastAccessExact,
  lastAccessTone,
  type LastAccessTone,
} from "../../utils/lastAccess";
import styles from "./MediaCard.module.css";

export type StatusTone = "green" | "blue" | "orange";

export interface MediaCardConfig<T> {
  getTitle: (item: T) => string;
  getImage: (item: T) => string | null;
  placeholderEmoji?: string;
  coverAspect?: string;
  getStatusBadge?: (item: T) => { label: string; tone: StatusTone } | null;
  getScore?: (item: T) => number | null;
  formatScore?: (score: number) => string;
  scoreColor?: (score: number) => string;
  libraryStatusColor: (status: string | undefined) => string;
  renderMeta: (item: T) => ReactNode;
  renderBelow?: (item: T) => ReactNode;
}

const TONE_CLASS: Record<StatusTone, string> = {
  green: styles.statusGreen,
  blue: styles.statusBlue,
  orange: styles.statusOrange,
};

const ACCESS_TONE_CLASS: Record<LastAccessTone, string> = {
  never: styles.accessNever,
  recent: styles.accessRecent,
  old: styles.accessOld,
  ancient: styles.accessAncient,
};

// Só aparece com o botão "Último acesso" ligado — por padrão o card não carrega
// esse texto. Na capa de coleção o valor é o mais recente entre os membros.
function LastAccessPill({ at }: { at: string | null }) {
  return (
    <span
      className={`${styles.accessPill} ${ACCESS_TONE_CLASS[lastAccessTone(at)]}`}
      title={at ? formatLastAccessExact(at) : "Nunca acessado"}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      {at ? formatLastAccess(at) : "nunca"}
    </span>
  );
}

interface MediaCardProps<T, E extends { status: string; score: number; lastAccessAt?: string | null }> {
  item: T;
  config: MediaCardConfig<T>;
  libraryEntry?: E;
  onClick: () => void;
  onAdd: (e: MouseEvent) => void;
  isLibraryView?: boolean;
  // Capa de coleção: mostra só a média. Sem botão de status e sem o badge de
  // exibição/lançamento — esse estado é dos membros, não da coleção; o lugar
  // deles no topo fica para a contagem do FranchiseCard.
  isCollectionCover?: boolean;
  // Botão "Último acesso" da barra da biblioteca: revela a data em todos os cards.
  showLastAccess?: boolean;
  index?: number;
  selectionMode?: boolean;
  selected?: boolean;
  onLongPress?: () => void;
  onToggleSelect?: () => void;
}

export function MediaCard<T, E extends { status: string; score: number; lastAccessAt?: string | null }>({
  item,
  config,
  libraryEntry,
  onClick,
  onAdd,
  isLibraryView,
  isCollectionCover = false,
  showLastAccess = false,
  index = 0,
  selectionMode = false,
  selected = false,
  onLongPress,
  onToggleSelect,
}: MediaCardProps<T, E>) {
  const title = config.getTitle(item);
  const image = config.getImage(item);
  const badge = isCollectionCover ? null : config.getStatusBadge?.(item) ?? null;
  const score = config.getScore?.(item) ?? null;
  // Só na biblioteca: no catálogo não existe entry e a data não faz sentido.
  const accessPill =
    showLastAccess && isLibraryView && libraryEntry ? (
      <LastAccessPill at={libraryEntry.lastAccessAt ?? null} />
    ) : null;

  const suppressClickRef = useRef(false);
  const longPress = useLongPress(onLongPress, suppressClickRef);

  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (selectionMode && onToggleSelect) onToggleSelect();
    else onClick();
  };

  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ""}`}
      style={{ animationDelay: `${Math.min(index, 12) * 0.04}s` }}
      onClick={handleClick}
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerLeave={longPress.onPointerLeave}
      onPointerCancel={longPress.onPointerCancel}
      role="button"
      aria-label={title}
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
    >
      <div
        className={styles.imageWrapper}
        style={config.coverAspect ? { aspectRatio: config.coverAspect } : undefined}
      >
        {image ? (
          <img className={styles.coverImage} src={image} alt={title} loading="lazy" decoding="async" />
        ) : (
          <div className={styles.coverPlaceholder}>{config.placeholderEmoji ?? "🎬"}</div>
        )}

        {selectionMode && (
          <span className={`${styles.selectionCheck} ${selected ? styles.selectionCheckOn : ""}`} aria-hidden="true">
            {selected && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
          </span>
        )}

        {/* Com overlay o pill entra no fluxo dele, acima do título (nada é coberto).
            Sem overlay (YouTube, que descreve o vídeo abaixo da imagem) ele flutua
            no canto de baixo, onde a imagem está livre. */}
        {!config.renderBelow ? (
          <div className={styles.overlay}>
            {accessPill}
            <div className={styles.title}>{title}</div>
            {config.renderMeta(item)}
          </div>
        ) : (
          accessPill && <div className={styles.accessFloat}>{accessPill}</div>
        )}

        <div className={styles.topBadges}>
          {!isCollectionCover && (
            <button
              type="button"
              className={`${styles.addButton} ${libraryEntry ? styles.inLibrary : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onAdd(e);
              }}
              title={libraryEntry ? "Na biblioteca" : "Adicionar à biblioteca"}
              aria-label={libraryEntry ? "Na biblioteca" : "Adicionar à biblioteca"}
            >
              {libraryEntry ? (
                <span
                  className={styles.statusDot}
                  style={{ backgroundColor: config.libraryStatusColor(libraryEntry.status) }}
                />
              ) : (
                "+"
              )}
            </button>
          )}
          {badge && (
            <span className={`${styles.statusBadge} ${TONE_CLASS[badge.tone]}`}>{badge.label}</span>
          )}
        </div>

        {isLibraryView
          ? libraryEntry && libraryEntry.score > 0 && (
              <span className={`${styles.scoreBadge} ${styles.libraryScoreBadge}`}>
                ⭐ {libraryEntry.score.toFixed(1)}
              </span>
            )
          : score != null && score > 0 && config.formatScore && config.scoreColor && (
              <span className={styles.scoreBadge} style={{ color: config.scoreColor(score) }}>
                ★ {config.formatScore(score)}
              </span>
            )}
      </div>
      {config.renderBelow && <div className={styles.belowInfo}>{config.renderBelow(item)}</div>}
    </div>
  );
}
