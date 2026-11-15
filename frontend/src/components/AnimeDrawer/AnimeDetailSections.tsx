import type { AnimeDetail } from "../../types/anime";
import { CoverImage } from "../CoverImage/CoverImage";
import styles from "./AnimeDrawer.module.css";

interface AnimeDetailSectionsProps {
  anime: AnimeDetail;
  // Coluna larga (visão de detalhe): ficha em mais colunas.
  wide?: boolean;
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "RELEASING": return "Em exibição";
    case "FINISHED": return "Finalizado";
    case "NOT_YET_RELEASED": return "Não lançado";
    default: return status;
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// O miolo do detalhe de um anime, igual no drawer e na visão de detalhe. Devolve
// um fragmento: quem monta é dono do espaçamento entre as seções.
export function AnimeDetailSections({ anime, wide = false }: AnimeDetailSectionsProps) {
  const streamingLinks = anime.externalLinks.filter((l) => l.type === "STREAMING");

  return (
    <>
      {anime.description && (
        <div
          className={styles.description}
          dangerouslySetInnerHTML={{ __html: anime.description.replace(/<br\s*\/?>/g, " ") }}
        />
      )}

      <div className={`${styles.infoGrid} ${wide ? styles.infoGridWide : ""}`}>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Status</span>
          <span className={styles.infoValue}>{getStatusLabel(anime.status)}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Episódios</span>
          <span className={styles.infoValue}>{anime.episodes ?? "?"}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Nota Média</span>
          <span className={styles.infoValue}>
            {anime.averageScore
              ? `★ ${(anime.averageScore / 10).toFixed(1)}${anime.ratingCount ? ` (${anime.ratingCount.toLocaleString("pt-BR")})` : ""}`
              : "N/A"}
          </span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Temporada</span>
          <span className={styles.infoValue}>
            {anime.season && anime.seasonYear ? `${anime.season} ${anime.seasonYear}` : "N/A"}
          </span>
        </div>
        {anime.nextAiringEpisode && (
          <>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Próximo Episódio</span>
              <span className={styles.infoValue}>Ep {anime.nextAiringEpisode.episode}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Data</span>
              <span className={styles.infoValue}>{formatDate(anime.nextAiringEpisode.airingAt)}</span>
            </div>
          </>
        )}
      </div>

      {anime.genres.length > 0 && (
        <div>
          <div className={styles.sectionTitle}>Gêneros</div>
          <div className={styles.genres}>
            {anime.genres.map((g) => (
              <span key={g} className={styles.genreTag}>{g}</span>
            ))}
          </div>
        </div>
      )}

      {streamingLinks.length > 0 && (
        <div>
          <div className={styles.sectionTitle}>Onde assistir</div>
          <div className={styles.streamingLinks}>
            {streamingLinks.map((link) => (
              <a
                key={link.url}
                className={styles.streamingLink}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <CoverImage className={styles.streamingLinkIcon} src={link.icon} alt="" />
                {link.site}
              </a>
            ))}
          </div>
        </div>
      )}

      {anime.streamingEpisodes.length > 0 && (
        <div>
          <div className={styles.sectionTitle}>Episódios</div>
          <div className={styles.episodes}>
            {anime.streamingEpisodes.map((ep) => (
              <a
                key={ep.url}
                className={styles.episode}
                href={ep.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <CoverImage className={styles.episodeThumb} src={ep.thumbnail} alt="" />
                <div className={styles.episodeBody}>
                  <div className={styles.episodeName}>{ep.title || "Episódio"}</div>
                  {ep.site && <div className={styles.episodeSite}>{ep.site}</div>}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
