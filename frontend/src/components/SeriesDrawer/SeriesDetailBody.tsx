import type { ReactNode } from "react";
import type { SeriesDetail } from "../../types/series";
import { TrailerEmbed } from "../TrailerEmbed/TrailerEmbed";
import { SeriesDetailSections } from "./SeriesDetailSections";
import styles from "./SeriesDrawer.module.css";
import { CoverImage } from "../CoverImage/CoverImage";

// Corpo compartilhado pelo SeriesDrawer e pelo SeasonDrawer: os dados exibidos
// são sempre os da série; os overrides trocam só o que é próprio da temporada.
interface SeriesDetailBodyProps {
  series: SeriesDetail;
  poster?: string | null;
  tagline?: string | null;
  overview?: string | null;
  // Sobreposto ao player; o SeasonDrawer usa para a navegação entre temporadas.
  playerOverlay?: ReactNode;
  children?: ReactNode;
}

export function SeriesDetailBody({
  series,
  poster,
  tagline,
  overview,
  playerOverlay,
  children,
}: SeriesDetailBodyProps) {
  const coverImage = poster ?? series.posterImage;
  const taglineText = tagline ?? series.tagline;

  return (
    <>
      <CoverImage
        className={styles.banner}
        src={series.backdropImage}
        alt=""
        eager
        fallback={<div className={styles.bannerPlaceholder} />}
      />

      <div className={styles.header}>
        <CoverImage
          className={styles.coverImage}
          src={coverImage}
          alt={series.title}
          eager
          fallback={<div className={styles.coverPlaceholder}>📺</div>}
        />
        <div className={styles.headerInfo}>
          <div className={styles.title}>{series.title}</div>
          {taglineText && <div className={styles.tagline}>{taglineText}</div>}
        </div>
      </div>

      <div className={styles.content}>
        {series.trailerKey && (
          <TrailerEmbed youtubeId={series.trailerKey} overlay={playerOverlay} autoPlay />
        )}

        <SeriesDetailSections series={series} overview={overview} />

        {children}
      </div>
    </>
  );
}
