import type { CSSProperties } from "react";
import type { ReleaseItem } from "../../utils/recentReleases";
import { AnimeIcon, MovieIcon, SeriesIcon, BookIcon, GameIcon } from "../Sidebar/Sidebar.icons";
import { formatLastAccess, formatLastAccessExact } from "../../utils/lastAccess";
import styles from "./ReleaseCarousel.module.css";

const MEDIA_ICON: Record<ReleaseItem["media"], typeof AnimeIcon> = {
  anime: AnimeIcon,
  movie: MovieIcon,
  series: SeriesIcon,
  game: GameIcon,
  book: BookIcon,
};

const MEDIA_COLOR: Record<ReleaseItem["media"], string> = {
  anime: "var(--color-media-anime)",
  movie: "var(--color-media-movie)",
  series: "var(--color-media-series)",
  game: "var(--color-media-game)",
  book: "var(--color-media-book)",
};

interface ReleaseCarouselProps {
  items: ReleaseItem[];
  onSelect: (item: ReleaseItem) => void;
}

export function ReleaseCarousel({ items, onSelect }: ReleaseCarouselProps) {
  return (
    <div className={styles.track}>
      {items.map((item) => {
        const Icon = MEDIA_ICON[item.media];
        const iso = new Date(item.when).toISOString();
        return (
          <button
            type="button"
            className={styles.card}
            key={`${item.media}-${item.externalId}-${item.seasonNumber ?? ""}`}
            style={{ "--media-color": MEDIA_COLOR[item.media] } as CSSProperties}
            onClick={() => onSelect(item)}
            title={`${item.title} — ${item.detail} em ${formatLastAccessExact(iso)}`}
          >
            <div className={styles.imageWrapper}>
              {item.poster ? (
                <img className={styles.coverImage} src={item.poster} alt="" loading="lazy" />
              ) : (
                <div className={styles.coverPlaceholder}>
                  <Icon className={styles.placeholderIcon} />
                </div>
              )}
              <div className={styles.overlay}>
                <span className={styles.whenPill}>{formatLastAccess(iso)}</span>
                <span className={styles.title}>{item.title}</span>
                <span className={styles.meta}>
                  <Icon className={styles.metaIcon} />
                  <span className={styles.metaText}>{item.detail}</span>
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
