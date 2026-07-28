import { useState, useEffect, useCallback, useRef } from "react";
import type { SeasonDetail, SeriesDetail } from "../../types/series";
import { fetchSeasonById, fetchSeriesById } from "../../services/seriesService";
import { SeriesDetailBody } from "../SeriesDrawer/SeriesDetailBody";
import { formatAirDate } from "../../utils/seriesFormat";
import drawer from "../SeriesDrawer/SeriesDrawer.module.css";
import styles from "./SeasonDrawer.module.css";

interface SeasonDrawerProps {
  seriesId: number;
  seasonNumber: number;
  onClose: () => void;
  onSeriesLoad?: (series: SeriesDetail) => void;
}

export function SeasonDrawer({ seriesId, seasonNumber, onClose, onSeriesLoad }: SeasonDrawerProps) {
  const [data, setData] = useState<{ series: SeriesDetail; season: SeasonDetail } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const onSeriesLoadRef = useRef(onSeriesLoad);
  useEffect(() => {
    onSeriesLoadRef.current = onSeriesLoad;
  });

  useEffect(() => {
    let active = true;
    Promise.all([fetchSeriesById(seriesId), fetchSeasonById(seriesId, seasonNumber)])
      .then(([series, season]) => {
        if (!active) return;
        setData({ series, season });
        onSeriesLoadRef.current?.(series);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [seriesId, seasonNumber]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  const seasonLabel = data?.season.name || `Temporada ${seasonNumber}`;

  return (
    <>
      <div className={drawer.overlay} onClick={onClose} />
      <div className={drawer.drawer}>
        <button className={drawer.closeButton} onClick={onClose}>✕</button>

        {loading ? (
          <div className={drawer.loading}>Carregando...</div>
        ) : data ? (
          <SeriesDetailBody
            series={data.series}
            poster={data.season.poster}
            tagline={seasonLabel}
            overview={data.season.overview ?? data.series.overview}
          >
            {data.season.episodes.length > 0 && (
              <div>
                <div className={drawer.sectionTitle}>Episódios</div>
                <div className={styles.episodes}>
                  {data.season.episodes.map((ep) => (
                    <div key={ep.episodeNumber} className={styles.episode}>
                      {ep.still && <img className={styles.episodeStill} src={ep.still} alt="" loading="lazy" />}
                      <div className={styles.episodeBody}>
                        <div className={styles.episodeHead}>
                          <span className={styles.episodeNumber}>{ep.episodeNumber}.</span>
                          <span className={styles.episodeName}>{ep.name || `Episódio ${ep.episodeNumber}`}</span>
                        </div>
                        <div className={styles.episodeMeta}>
                          {formatAirDate(ep.airDate)}
                          {ep.runtime ? ` · ${ep.runtime} min` : ""}
                          {ep.voteAverage ? ` · ★ ${ep.voteAverage.toFixed(1)}` : ""}
                        </div>
                        {ep.overview && <div className={styles.episodeOverview}>{ep.overview}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SeriesDetailBody>
        ) : (
          <div className={drawer.loading}>{error ? "Erro ao carregar detalhes." : ""}</div>
        )}
      </div>
    </>
  );
}
