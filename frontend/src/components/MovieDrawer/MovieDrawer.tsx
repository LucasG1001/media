import { useState, useEffect, useCallback, useRef } from "react";
import type { MovieDetail } from "../../types/movie";
import { fetchMovieById } from "../../services/movieService";
import { TrailerEmbed } from "../TrailerEmbed/TrailerEmbed";
import { NotesBlock } from "../NotesBlock/NotesBlock";
import styles from "./MovieDrawer.module.css";

// notes/onNotesChange só vêm quando o item está na biblioteca — no catálogo o
// bloco de anotação não aparece.
interface MovieDrawerProps {
  movieId: number;
  onClose: () => void;
  onMovieLoad?: (movie: MovieDetail) => void;
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

export function MovieDrawer({ movieId, onClose, onMovieLoad, notes, onNotesChange }: MovieDrawerProps) {
  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const onMovieLoadRef = useRef(onMovieLoad);
  useEffect(() => {
    onMovieLoadRef.current = onMovieLoad;
  });

  useEffect(() => {
    let active = true;
    fetchMovieById(movieId)
      .then((data) => {
        if (!active) return;
        setMovie(data);
        onMovieLoadRef.current?.(data);
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
  }, [movieId]);

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
                <TrailerEmbed youtubeId={movie.trailerKey} />
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

              {onNotesChange && <NotesBlock value={notes ?? null} onSave={onNotesChange} />}
            </div>
          </>
        ) : (
          <div className={styles.loading}>{error ? "Erro ao carregar detalhes." : ""}</div>
        )}
      </div>
    </>
  );
}
