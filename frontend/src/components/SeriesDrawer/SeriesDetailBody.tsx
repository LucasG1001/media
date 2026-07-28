import type { ReactNode } from "react";
import type { SeriesDetail } from "../../types/series";
import { TrailerEmbed } from "../TrailerEmbed/TrailerEmbed";
import { getAirStatusLabel, formatAirDate } from "../../utils/seriesFormat";
import styles from "./SeriesDrawer.module.css";

// Corpo compartilhado pelo SeriesDrawer e pelo SeasonDrawer: os dados exibidos
// são sempre os da série; os overrides trocam só o que é próprio da temporada.
interface SeriesDetailBodyProps {
  series: SeriesDetail;
  poster?: string | null;
  tagline?: string | null;
  overview?: string | null;
  children?: ReactNode;
}

export function SeriesDetailBody({ series, poster, tagline, overview, children }: SeriesDetailBodyProps) {
  const coverImage = poster ?? series.posterImage;
  const taglineText = tagline ?? series.tagline;
  const overviewText = overview ?? series.overview;

  return (
    <>
      {series.backdropImage ? (
        <img className={styles.banner} src={series.backdropImage} alt="" />
      ) : (
        <div className={styles.bannerPlaceholder} />
      )}

      <div className={styles.header}>
        {coverImage ? (
          <img className={styles.coverImage} src={coverImage} alt={series.title} />
        ) : (
          <div className={styles.coverPlaceholder}>📺</div>
        )}
        <div className={styles.headerInfo}>
          <div className={styles.title}>{series.title}</div>
          {taglineText && <div className={styles.tagline}>{taglineText}</div>}
        </div>
      </div>

      <div className={styles.content}>
        {series.trailerKey && (
          <TrailerEmbed youtubeId={series.trailerKey} />
        )}

        {overviewText && <div className={styles.description}>{overviewText}</div>}

        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Status</span>
            <span className={styles.infoValue}>{getAirStatusLabel(series.airStatus)}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Estreia</span>
            <span className={styles.infoValue}>{formatAirDate(series.firstAirDate)}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Temporadas</span>
            <span className={styles.infoValue}>{series.seasons ?? "?"}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Episódios</span>
            <span className={styles.infoValue}>{series.episodes ?? "?"}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Nota Média</span>
            <span className={styles.infoValue}>
              {series.voteAverage
                ? `★ ${series.voteAverage.toFixed(1)}${series.voteCount ? ` (${series.voteCount.toLocaleString("pt-BR")})` : ""}`
                : "N/A"}
            </span>
          </div>
        </div>

        {series.genres.length > 0 && (
          <div>
            <div className={styles.sectionTitle}>Gêneros</div>
            <div className={styles.genres}>
              {series.genres.map((g) => (
                <span key={g} className={styles.genreTag}>{g}</span>
              ))}
            </div>
          </div>
        )}

        {series.watchProviders.length > 0 && (
          <div>
            <div className={styles.sectionTitle}>Onde assistir</div>
            <div className={styles.providers}>
              {series.watchProviders.map((p) => (
                <div key={p.name} className={styles.provider}>
                  {p.logo && <img className={styles.providerLogo} src={p.logo} alt="" />}
                  {p.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {children}
      </div>
    </>
  );
}
