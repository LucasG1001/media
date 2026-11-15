import type { SeriesDetail } from "../../types/series";
import { getAirStatusLabel, formatAirDate } from "../../utils/seriesFormat";
import { CoverImage } from "../CoverImage/CoverImage";
import styles from "./SeriesDrawer.module.css";

interface SeriesDetailSectionsProps {
  series: SeriesDetail;
  // Sinopse da temporada, quando o que está aberto é uma temporada.
  overview?: string | null;
  // Coluna larga (visão de detalhe): ficha em mais colunas.
  wide?: boolean;
}

// O miolo do detalhe de uma série (os dados são sempre os da série; só a sinopse
// pode ser da temporada), igual nos drawers e na visão de detalhe. Devolve um
// fragmento: quem monta é dono do espaçamento entre as seções.
export function SeriesDetailSections({ series, overview, wide = false }: SeriesDetailSectionsProps) {
  const overviewText = overview ?? series.overview;

  return (
    <>
      {overviewText && <div className={styles.description}>{overviewText}</div>}

      <div className={`${styles.infoGrid} ${wide ? styles.infoGridWide : ""}`}>
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
