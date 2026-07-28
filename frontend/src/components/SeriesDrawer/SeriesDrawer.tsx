import { useState, useEffect, useCallback, useRef } from "react";
import type { SeriesDetail } from "../../types/series";
import { fetchSeriesById } from "../../services/seriesService";
import { SeriesDetailBody } from "./SeriesDetailBody";
import styles from "./SeriesDrawer.module.css";

interface SeriesDrawerProps {
  seriesId: number;
  onClose: () => void;
  onSeriesLoad?: (series: SeriesDetail) => void;
}

export function SeriesDrawer({ seriesId, onClose, onSeriesLoad }: SeriesDrawerProps) {
  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const onSeriesLoadRef = useRef(onSeriesLoad);
  useEffect(() => {
    onSeriesLoadRef.current = onSeriesLoad;
  });

  useEffect(() => {
    let active = true;
    fetchSeriesById(seriesId)
      .then((data) => {
        if (!active) return;
        setSeries(data);
        onSeriesLoadRef.current?.(data);
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
  }, [seriesId]);

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

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.drawer}>
        <button className={styles.closeButton} onClick={onClose}>✕</button>

        {loading ? (
          <div className={styles.loading}>Carregando...</div>
        ) : series ? (
          <SeriesDetailBody series={series} />
        ) : (
          <div className={styles.loading}>{error ? "Erro ao carregar detalhes." : ""}</div>
        )}
      </div>
    </>
  );
}
