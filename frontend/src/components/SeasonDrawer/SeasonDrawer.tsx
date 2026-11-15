import type { SeriesDetail } from "../../types/series";
import { useSeasonDetail } from "../../hooks/useMediaDetail";
import { SeriesDetailBody } from "../SeriesDrawer/SeriesDetailBody";
import { SeasonEpisodes } from "./SeasonEpisodes";
import { NotesBlock } from "../NotesBlock/NotesBlock";
import drawer from "../SeriesDrawer/SeriesDrawer.module.css";
import { DrawerNav, type DrawerNavProps } from "../DrawerNav/DrawerNav";
import { useDrawerKeys } from "../../hooks/useDrawerKeys";
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
  // Navegar entre temporadas troca a chave sem remontar o drawer; o hook guarda
  // o payload junto com a chave a que pertence.
  const { key, series, season, loading, error } = useSeasonDetail(seriesId, seasonNumber, onSeriesLoad);

  useDrawerKeys(onClose, nav);

  return (
    <>
      <div className={drawer.overlay} onClick={onClose} />
      <div className={drawer.drawer}>
        <button className={drawer.closeButton} onClick={onClose}>✕</button>
        {nav && <DrawerNav {...nav} />}

        {loading ? (
          <div className={drawer.loading}>Carregando...</div>
        ) : series && season ? (
          <SeriesDetailBody
            playerOverlay={nav && <DrawerNav {...nav} variant="float" />}
            series={series}
            poster={season.poster}
            tagline={season.name || `Temporada ${seasonNumber}`}
            overview={season.overview ?? series.overview}
          >
            <SeasonEpisodes episodes={season.episodes} />

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
