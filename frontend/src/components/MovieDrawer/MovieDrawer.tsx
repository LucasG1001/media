import { useState, useEffect, useRef } from "react";
import type { MovieDetail } from "../../types/movie";
import { fetchMovieById } from "../../services/movieService";
import { TrailerEmbed } from "../TrailerEmbed/TrailerEmbed";
import { NotesBlock } from "../NotesBlock/NotesBlock";
import { DrawerNav, type DrawerNavProps } from "../DrawerNav/DrawerNav";
import { useDrawerKeys } from "../../hooks/useDrawerKeys";
import styles from "./MovieDrawer.module.css";

// notes/onNotesChange só vêm quando o item está na biblioteca — no catálogo o
// bloco de anotação não aparece.
interface MovieDrawerProps {
  movieId: number;
  onClose: () => void;
  onMovieLoad?: (movie: MovieDetail) => void;
  // Navegação entre os itens da coleção, sem fechar o drawer.
  nav?: DrawerNavProps;
  notes?: string | null;
  onNotesChange?: (notes: string) => void;
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "RELEASED": return "Lançado";
    case "UPCOMING": return "Em breve";
    default: return status;
  }
}

function formatRuntime(minutes: number | null): string {
  if (!minutes) return "?";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

function formatReleaseDate(date: string | null): string {
  if (!date) return "N/A";
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function MovieDrawer({ movieId, onClose, onMovieLoad, notes, onNotesChange, nav }: MovieDrawerProps) {
  // Guardados junto com o id a que pertencem, e loading/error derivados daí:
  // navegar troca o id sem remontar o drawer, e estado solto seguiria falando do
  // item anterior (mostrando-o enquanto busca, ou grudando um erro antigo).
  const [loaded, setLoaded] = useState<{ id: number; data: MovieDetail } | null>(null);
  const [failedId, setFailedId] = useState<number | null>(null);
  const movie = loaded?.id === movieId ? loaded.data : null;
  const error = failedId === movieId;
  const loading = !movie && !error;

  const onMovieLoadRef = useRef(onMovieLoad);
  useEffect(() => {
    onMovieLoadRef.current = onMovieLoad;
  });

  useEffect(() => {
    let active = true;
    fetchMovieById(movieId)
      .then((data) => {
        if (!active) return;
        setLoaded({ id: movieId, data });
        onMovieLoadRef.current?.(data);
      })
      .catch(() => {
        if (active) setFailedId(movieId);
      });

    return () => {
      active = false;
    };
  }, [movieId]);

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
            {movie.backdropImage ? (
              <img className={styles.banner} src={movie.backdropImage} alt="" />
            ) : (
              <div className={styles.bannerPlaceholder} />
            )}

            <div className={styles.header}>
              {movie.posterImage ? (
                <img className={styles.coverImage} src={movie.posterImage} alt={movie.title} />
              ) : (
                <div className={styles.coverPlaceholder}>🎬</div>
              )}
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

              {movie.overview && <div className={styles.description}>{movie.overview}</div>}

              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Status</span>
                  <span className={styles.infoValue}>{getStatusLabel(movie.movieStatus)}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Duração</span>
                  <span className={styles.infoValue}>{formatRuntime(movie.runtime)}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Lançamento</span>
                  <span className={styles.infoValue}>{formatReleaseDate(movie.releaseDate)}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Nota Média</span>
                  <span className={styles.infoValue}>
                    {movie.voteAverage
                      ? `★ ${movie.voteAverage.toFixed(1)}${movie.voteCount ? ` (${movie.voteCount.toLocaleString("pt-BR")})` : ""}`
                      : "N/A"}
                  </span>
                </div>
              </div>

              {movie.genres.length > 0 && (
                <div>
                  <div className={styles.sectionTitle}>Gêneros</div>
                  <div className={styles.genres}>
                    {movie.genres.map((g) => (
                      <span key={g} className={styles.genreTag}>{g}</span>
                    ))}
                  </div>
                </div>
              )}

              {movie.watchProviders.length > 0 && (
                <div>
                  <div className={styles.sectionTitle}>Onde assistir</div>
                  <div className={styles.providers}>
                    {movie.watchProviders.map((p) => (
                      <div key={p.name} className={styles.provider}>
                        {p.logo && <img className={styles.providerLogo} src={p.logo} alt="" />}
                        {p.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {onNotesChange && <NotesBlock key={movieId} value={notes ?? null} onSave={onNotesChange} />}
            </div>
          </>
        ) : (
          <div className={styles.loading}>{error ? "Erro ao carregar detalhes." : ""}</div>
        )}
      </div>
    </>
  );
}
