import type { GameDetail } from "../../types/game";
import { CoverImage } from "../CoverImage/CoverImage";
import styles from "./GameDetailSections.module.css";

interface GameDetailSectionsProps {
  game: GameDetail;
  // Coluna larga (visão de detalhe): ficha em mais colunas e screenshots maiores.
  wide?: boolean;
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "RELEASED": return "Lançado";
    case "UPCOMING": return "Em breve";
    default: return status;
  }
}

function formatReleased(date: string | null): string {
  if (!date) return "N/A";
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// O miolo do detalhe de um jogo, igual no drawer e na visão de detalhe. Devolve
// um fragmento: quem monta é dono do espaçamento entre as seções.
export function GameDetailSections({ game, wide = false }: GameDetailSectionsProps) {
  return (
    <>
      {game.screenshots.length > 0 && (
        <div className={`${styles.screenshots} ${wide ? styles.screenshotsWide : ""}`}>
          {game.screenshots.map((src) => (
            <CoverImage key={src} className={styles.screenshot} src={src} alt="" />
          ))}
        </div>
      )}

      {game.description && <div className={styles.description}>{game.description}</div>}

      <div className={`${styles.infoGrid} ${wide ? styles.infoGridWide : ""}`}>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Status</span>
          <span className={styles.infoValue}>{getStatusLabel(game.gameStatus)}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Lançamento</span>
          <span className={styles.infoValue}>{formatReleased(game.released)}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Crítica</span>
          <span className={styles.infoValue}>{game.metacritic ?? "N/A"}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Nota IGDB</span>
          <span className={styles.infoValue}>
            {game.rating
              ? `★ ${game.rating.toFixed(1)}${game.ratingsCount ? ` (${game.ratingsCount.toLocaleString("pt-BR")})` : ""}`
              : "N/A"}
          </span>
        </div>
        {game.esrb && (
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Classificação</span>
            <span className={styles.infoValue}>{game.esrb}</span>
          </div>
        )}
        {game.platforms.length > 0 && (
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Plataformas</span>
            <span className={styles.infoValue}>{game.platforms.join(", ")}</span>
          </div>
        )}
      </div>

      {game.genres.length > 0 && (
        <div>
          <div className={styles.sectionTitle}>Gêneros</div>
          <div className={styles.genres}>
            {game.genres.map((g) => (
              <span key={g} className={styles.genreTag}>{g}</span>
            ))}
          </div>
        </div>
      )}

      {game.stores.length > 0 && (
        <div>
          <div className={styles.sectionTitle}>Onde comprar</div>
          <div className={styles.stores}>
            {game.stores.map((s) => (
              <a
                key={s.url}
                className={styles.store}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {s.name}
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
