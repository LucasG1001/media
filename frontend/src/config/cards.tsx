import type { AnimeCard } from "../types/anime";
import type { MovieCard } from "../types/movie";
import type { SeriesCard } from "../types/series";
import type { BookCard } from "../types/book";
import type { GameCard } from "../types/game";
import type { YoutubeCard } from "../types/youtubeLibrary";
import type { SeasonMember } from "../utils/seasonGroups";
import type { MediaCardConfig } from "../components/MediaCard/MediaCard";
import { StoreGlyph } from "../components/MediaCard/StoreIcons";
import { CardTags } from "../components/TagChip/CardTags";
import { formatDuration } from "../utils/formatDuration";
import { formatViews } from "../utils/formatViews";
import cardStyles from "../components/MediaCard/MediaCard.module.css";
import ytStyles from "./youtubeCard.module.css";

function scoreColorFn(high: number, mid: number): (score: number) => string {
  return (score) => {
    if (score >= high) return "var(--color-score-high)";
    if (score >= mid) return "var(--color-score-mid)";
    return "var(--color-score-low)";
  };
}

function catalogStatusColor(status: string | undefined): string {
  switch (status) {
    case "plan_to_watch":
    case "plan_to_read":
    case "plan_to_play":
      return "var(--color-text-secondary)";
    case "watched":
    case "read":
    case "beaten":
      return "var(--color-success)";
    case "dropped":
      return "var(--color-error)";
    default:
      return "var(--color-text-secondary)";
  }
}

export const animeCardConfig: MediaCardConfig<AnimeCard> = {
  getTitle: (a) => a.title,
  getImage: (a) => a.coverImage,
  getStatusBadge: (a) => {
    switch (a.status) {
      case "RELEASING": return { label: "Em exibição", tone: "green" };
      case "FINISHED": return { label: "Finalizado", tone: "blue" };
      case "NOT_YET_RELEASED": return { label: "Em breve", tone: "orange" };
      default: return { label: a.status, tone: "blue" };
    }
  },
  getScore: (a) => a.averageScore ?? null,
  formatScore: (s) => (s / 10).toFixed(1),
  scoreColor: scoreColorFn(75, 50),
  libraryStatusColor: catalogStatusColor,
  renderMeta: (a) =>
    a.seasonYear || a.streamingLinks.length > 0 ? (
      <div className={cardStyles.bottomRow}>
        {a.seasonYear ? <span className={cardStyles.year}>{a.seasonYear}</span> : <span />}
        {a.streamingLinks.length > 0 && (
          <div className={cardStyles.streamingIcons}>
            {a.streamingLinks.slice(0, 3).map((link) =>
              link.icon ? (
                <img
                  key={link.site}
                  className={cardStyles.streamingIcon}
                  src={link.icon}
                  alt={link.site}
                  title={link.site}
                />
              ) : null
            )}
          </div>
        )}
      </div>
    ) : null,
};

export const movieCardConfig: MediaCardConfig<MovieCard> = {
  getTitle: (m) => m.title,
  getImage: (m) => m.posterImage,
  placeholderEmoji: "🎬",
  getStatusBadge: (m) =>
    m.movieStatus === "UPCOMING"
      ? { label: "Em breve", tone: "orange" }
      : { label: "Lançado", tone: "blue" },
  getScore: (m) => m.voteAverage ?? null,
  formatScore: (s) => s.toFixed(1),
  scoreColor: scoreColorFn(7.5, 5),
  libraryStatusColor: catalogStatusColor,
  renderMeta: (m) => (
    <div className={cardStyles.meta}>
      <span className={cardStyles.year}>{m.releaseDate ? m.releaseDate.slice(0, 4) : "—"}</span>
    </div>
  ),
};

export const seriesCardConfig: MediaCardConfig<SeriesCard> = {
  getTitle: (s) => s.title,
  getImage: (s) => s.posterImage,
  placeholderEmoji: "📺",
  getStatusBadge: (s) =>
    s.seriesStatus === "UPCOMING"
      ? { label: "Em breve", tone: "orange" }
      : { label: "No ar", tone: "green" },
  getScore: (s) => s.voteAverage ?? null,
  formatScore: (s) => s.toFixed(1),
  scoreColor: scoreColorFn(7.5, 5),
  libraryStatusColor: catalogStatusColor,
  renderMeta: (s) => (
    <div className={cardStyles.meta}>
      <span className={cardStyles.year}>{s.firstAirDate ? s.firstAirDate.slice(0, 4) : "—"}</span>
    </div>
  ),
};

// Card da "coleção de temporadas": serve tanto a capa (série) quanto cada
// temporada — ambos são SeasonMember com poster/title/score.
export const seasonCardConfig: MediaCardConfig<SeasonMember> = {
  getTitle: (m) => m.title,
  getImage: (m) => m.poster,
  placeholderEmoji: "📺",
  getScore: (m) => m.score || null,
  formatScore: (s) => s.toFixed(1),
  scoreColor: scoreColorFn(7.5, 5),
  libraryStatusColor: catalogStatusColor,
  renderMeta: (m) => (
    <div className={cardStyles.meta}>
      <span className={cardStyles.year}>
        {m.episodeCount != null ? `${m.episodeCount} ep${m.episodeCount === 1 ? "" : "s"}` : m.airDate ? m.airDate.slice(0, 4) : "—"}
      </span>
    </div>
  ),
};

export const bookCardConfig: MediaCardConfig<BookCard> = {
  getTitle: (b) => b.title,
  getImage: (b) => b.coverImage,
  placeholderEmoji: "📚",
  coverAspect: "3 / 4.6",
  getStatusBadge: (b) =>
    b.bookStatus === "UPCOMING"
      ? { label: "Em breve", tone: "orange" }
      : { label: "Lançado", tone: "blue" },
  getScore: (b) => b.averageRating ?? null,
  formatScore: (s) => s.toFixed(1),
  // A nota da Hardcover é 0–5, não 0–10 como as outras mídias.
  scoreColor: scoreColorFn(4, 2.5),
  libraryStatusColor: catalogStatusColor,
  renderMeta: (b) => (
    <div className={cardStyles.meta}>
      <span className={cardStyles.author}>{b.authors.length > 0 ? b.authors.join(", ") : "—"}</span>
      <span className={cardStyles.year}>{b.releaseYear ?? b.publishedDate?.slice(0, 4) ?? "—"}</span>
    </div>
  ),
};

function youtubeStatusColor(status: string | undefined): string {
  switch (status) {
    case "liked":
      return "var(--color-success)";
    case "removed":
      return "var(--color-error)";
    default:
      return "var(--color-text-secondary)";
  }
}

export const youtubeCardConfig: MediaCardConfig<YoutubeCard> = {
  getTitle: (v) => v.title,
  getImage: (v) => v.thumbnail,
  placeholderEmoji: "▶️",
  coverAspect: "16 / 9",
  libraryStatusColor: youtubeStatusColor,
  renderMeta: () => null,
  renderBelow: (v) => (
    <div className={ytStyles.below}>
      {v.channelThumbnail && <img className={ytStyles.avatar} src={v.channelThumbnail} alt="" loading="lazy" decoding="async" />}
      <div className={ytStyles.text}>
        <div className={ytStyles.title} title={v.title}>{v.title}</div>
        {v.channelTitle && <div className={ytStyles.channel}>{v.channelTitle}</div>}
        <div className={ytStyles.stats}>
          {formatDuration(v.durationSeconds)} · {formatViews(v.viewCount)}
        </div>
        {/* Vídeo avulso não tem tag: sem coleção, nem a linha de chips aparece. */}
        {v.collectionId != null && (
          <CardTags entryId={v.entryId} collectionId={v.collectionId} tags={v.tags} />
        )}
      </div>
    </div>
  ),
};

export const gameCardConfig: MediaCardConfig<GameCard> = {
  getTitle: (g) => g.title,
  getImage: (g) => g.backgroundImage,
  placeholderEmoji: "🎮",
  getStatusBadge: (g) =>
    g.gameStatus === "UPCOMING"
      ? { label: "Em breve", tone: "orange" }
      : { label: "Lançado", tone: "green" },
  getScore: (g) => g.rating ?? null,
  formatScore: (s) => s.toFixed(1),
  scoreColor: scoreColorFn(7.5, 5),
  libraryStatusColor: catalogStatusColor,
  renderMeta: (g) => (
    <div className={cardStyles.meta}>
      <span className={cardStyles.year}>{g.released ? g.released.slice(0, 4) : "—"}</span>
      {g.storeSlugs.length > 0 && (
        <div className={cardStyles.storeIcons}>
          {g.storeSlugs.slice(0, 3).map((slug) => (
            <StoreGlyph key={slug} slug={slug} className={cardStyles.storeIcon} />
          ))}
        </div>
      )}
    </div>
  ),
};
