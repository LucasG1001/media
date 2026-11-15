import type { MovieDetail } from "../../types/movie";
import { useMovieDetail } from "../../hooks/useMediaDetail";
import { MovieDetailSections } from "./MovieDetailSections";
import { TrailerEmbed } from "../TrailerEmbed/TrailerEmbed";
import { NotesBlock } from "../NotesBlock/NotesBlock";
import { DrawerNav, type DrawerNavProps } from "../DrawerNav/DrawerNav";
import { useDrawerKeys } from "../../hooks/useDrawerKeys";
import styles from "./MovieDrawer.module.css";
import { CoverImage } from "../CoverImage/CoverImage";
import { DrawerFallback, type DrawerFallbackData } from "../DrawerFallback/DrawerFallback";

// notes/onNotesChange só vêm quando o item está na biblioteca — no catálogo o
// bloco de anotação não aparece.
interface MovieDrawerProps {
  movieId: number;
  onClose: () => void;
  onMovieLoad?: (movie: MovieDetail) => void;
  // Navegação entre os itens da coleção, sem fechar o drawer.
  nav?: DrawerNavProps;
  // Dados salvos na biblioteca, usados quando nem a API externa nem o cache dela
  // responderem (offline sem o item nunca aberto).
  fallback?: DrawerFallbackData;
  notes?: string | null;
  onNotesChange?: (notes: string) => void;
}

export function MovieDrawer({ movieId, onClose, onMovieLoad, notes, onNotesChange, nav, fallback }: MovieDrawerProps) {
  // Navegar troca o id sem remontar o drawer; o hook guarda o payload junto com
  // o id a que pertence.
  const { movie, loading, error } = useMovieDetail(movieId, onMovieLoad);

  useDrawerKeys(onClose, nav);

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.drawer}>
        <button className={styles.closeButton} onClick={onClose}>✕</button>
        {nav && <DrawerNav {...nav} />}

        {loading ? (
          <div className={styles.loading}>Carregando...</div>
        ) : movie ? (
          <>
            <CoverImage
              className={styles.banner}
              src={movie.backdropImage}
              alt=""
              eager
              fallback={<div className={styles.bannerPlaceholder} />}
            />

            <div className={styles.header}>
              <CoverImage
                className={styles.coverImage}
                src={movie.posterImage}
                alt={movie.title}
                eager
                fallback={<div className={styles.coverPlaceholder}>🎬</div>}
              />
              <div className={styles.headerInfo}>
                <div className={styles.title}>{movie.title}</div>
                {movie.tagline && <div className={styles.tagline}>{movie.tagline}</div>}
              </div>
            </div>

            <div className={styles.content}>
              {movie.trailerKey && (
                <TrailerEmbed
                  youtubeId={movie.trailerKey}
                  overlay={nav && <DrawerNav {...nav} variant="float" />}
                  autoPlay
                />
              )}

              <MovieDetailSections movie={movie} />

              {onNotesChange && <NotesBlock key={movieId} value={notes ?? null} onSave={onNotesChange} />}
            </div>
          </>
        ) : error && fallback ? (
          <DrawerFallback
            {...fallback}
            notes={notes}
            onNotesChange={onNotesChange}
            notesKey={movieId}
          />
        ) : (
          <div className={styles.loading}>{error ? "Erro ao carregar detalhes." : ""}</div>
        )}
      </div>
    </>
  );
}
