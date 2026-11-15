import type { MovieDetail } from "../../types/movie";
import { formatRuntime } from "../../utils/formatRuntime";
import { CoverImage } from "../CoverImage/CoverImage";
import styles from "./MovieDrawer.module.css";

interface MovieDetailSectionsProps {
  movie: MovieDetail;
  // Coluna larga (visão de detalhe): ficha em mais colunas.
  wide?: boolean;
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "RELEASED": return "Lançado";
    case "UPCOMING": return "Em breve";
    default: return status;
  }
}

function formatReleaseDate(date: string | null): string {
  if (!date) return "N/A";
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// O miolo do detalhe de um filme, igual no drawer e na visão de detalhe. Devolve
// um fragmento: quem monta é dono do espaçamento entre as seções.
export function MovieDetailSections({ movie, wide = false }: MovieDetailSectionsProps) {
  return (
    <>
      {movie.overview && <div className={styles.description}>{movie.overview}</div>}

      <div className={`${styles.infoGrid} ${wide ? styles.infoGridWide : ""}`}>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Status</span>
          <span className={styles.infoValue}>{getStatusLabel(movie.movieStatus)}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Duração</span>
          <span className={styles.infoValue}>{movie.runtime ? formatRuntime(movie.runtime) : "?"}</span>
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
                <CoverImage className={styles.providerLogo} src={p.logo} alt="" />
                {p.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
