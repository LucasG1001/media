import { useState, useEffect, useRef } from "react";
import type { SeasonDetail, SeriesDetail } from "../../types/series";
import { fetchSeasonById, fetchSeriesById } from "../../services/seriesService";
import { SeriesDetailBody } from "../SeriesDrawer/SeriesDetailBody";
import { NotesBlock } from "../NotesBlock/NotesBlock";
import { formatAirDate } from "../../utils/seriesFormat";
import drawer from "../SeriesDrawer/SeriesDrawer.module.css";
import { DrawerNav, type DrawerNavProps } from "../DrawerNav/DrawerNav";
import { useDrawerKeys } from "../../hooks/useDrawerKeys";
import styles from "./SeasonDrawer.module.css";
import { CoverImage } from "../CoverImage/CoverImage";
import { DrawerFallback, type DrawerFallbackData } from "../DrawerFallback/DrawerFallback";

// notes/onNotesChange só vêm quando a série está na biblioteca — a anotação é da
// temporada, não da série.
interface SeasonDrawerProps {
  seriesId: number;
  seasonNumber: number;
  onClose: () => void;
  onSeriesLoad?: (series: SeriesDetail) => void;
  // Navegação entre os itens da coleção, sem fechar o drawer.
  nav?: DrawerNavProps;
  // Dados salvos na biblioteca, usados quando nem a API externa nem o cache dela
  // responderem (offline sem o item nunca aberto).
  fallback?: DrawerFallbackData;
  notes?: string | null;
  onNotesChange?: (notes: string) => void;
}

export function SeasonDrawer({
  seriesId,
  seasonNumber,
  onClose,
  onSeriesLoad,
  notes,
  onNotesChange,
  nav,
  fallback,
}: SeasonDrawerProps) {
  // Guardados junto com a chave a que pertencem, e loading/error derivados daí:
  // navegar entre temporadas troca a chave sem remontar o drawer, e estado solto
  // seguiria falando da temporada anterior.
  const key = `${seriesId}-${seasonNumber}`;
  const [loaded, setLoaded] = useState<
    { key: string; series: SeriesDetail; season: SeasonDetail } | null
  >(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const data = loaded?.key === key ? loaded : null;
  const error = failedKey === key;
  const loading = !data && !error;

  const onSeriesLoadRef = useRef(onSeriesLoad);
  useEffect(() => {
    onSeriesLoadRef.current = onSeriesLoad;
  });

  useEffect(() => {
    let active = true;
    Promise.all([fetchSeriesById(seriesId), fetchSeasonById(seriesId, seasonNumber)])
      .then(([series, season]) => {
        if (!active) return;
        setLoaded({ key, series, season });
        onSeriesLoadRef.current?.(series);
      })
      .catch(() => {
        if (active) setFailedKey(key);
      });
    return () => {
      active = false;
    };
  }, [seriesId, seasonNumber, key]);

  useDrawerKeys(onClose, nav);

  const seasonLabel = data?.season.name || `Temporada ${seasonNumber}`;

  return (
    <>
      <div className={drawer.overlay} onClick={onClose} />
      <div className={drawer.drawer}>
        <button className={drawer.closeButton} onClick={onClose}>✕</button>
        {nav && <DrawerNav {...nav} />}

        {loading ? (
          <div className={drawer.loading}>Carregando...</div>
        ) : data ? (
          <SeriesDetailBody
            playerOverlay={nav && <DrawerNav {...nav} variant="float" />}
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
                      <CoverImage className={styles.episodeStill} src={ep.still} alt="" />
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

            {onNotesChange && <NotesBlock key={key} value={notes ?? null} onSave={onNotesChange} />}
          </SeriesDetailBody>
        ) : error && fallback ? (
          <DrawerFallback
            {...fallback}
            notes={notes}
            onNotesChange={onNotesChange}
            notesKey={key}
          />
        ) : (
          <div className={drawer.loading}>{error ? "Erro ao carregar detalhes." : ""}</div>
        )}
      </div>
    </>
  );
}
