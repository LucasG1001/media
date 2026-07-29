import { useState, useEffect, useCallback, useRef } from "react";
import type { GameDetail } from "../../types/game";
import { fetchGameById } from "../../services/gameService";
import { TrailerEmbed } from "../TrailerEmbed/TrailerEmbed";
import { NotesBlock } from "../NotesBlock/NotesBlock";
import styles from "./GameDrawer.module.css";

// notes/onNotesChange só vêm quando o item está na biblioteca — no catálogo o
// bloco de anotação não aparece.
interface GameDrawerProps {
  gameId: number;
  onClose: () => void;
  onGameLoad?: (game: GameDetail) => void;
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

function formatReleased(date: string | null): string {
  if (!date) return "N/A";
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function GameDrawer({ gameId, onClose, onGameLoad, notes, onNotesChange }: GameDrawerProps) {
  const [game, setGame] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const onGameLoadRef = useRef(onGameLoad);
  useEffect(() => {
    onGameLoadRef.current = onGameLoad;
  });

  useEffect(() => {
    let active = true;
    fetchGameById(gameId)
      .then((data) => {
        if (!active) return;
        setGame(data);
        onGameLoadRef.current?.(data);
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
  }, [gameId]);

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
        ) : game ? (
          <>
            {game.screenshots[0] || game.backgroundImage ? (
              <img className={styles.banner} src={game.screenshots[0] ?? game.backgroundImage ?? undefined} alt="" />
            ) : (
              <div className={styles.bannerPlaceholder} />
            )}

            <div className={styles.header}>
              <div className={styles.title}>{game.title}</div>
              {game.developers.length > 0 && (
                <div className={styles.developers}>{game.developers.join(" · ")}</div>
              )}
            </div>

            <div className={styles.content}>
              {game.trailer && (
                <TrailerEmbed youtubeId={game.trailer.youtubeId} />
              )}

              {game.screenshots.length > 0 && (
                <div className={styles.screenshots}>
                  {game.screenshots.map((src) => (
                    <img key={src} className={styles.screenshot} src={src} alt="" loading="lazy" />
                  ))}
                </div>
              )}

              {game.description && <div className={styles.description}>{game.description}</div>}

              <div className={styles.infoGrid}>
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
