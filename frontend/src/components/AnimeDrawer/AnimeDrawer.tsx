import { useState, useEffect, useRef } from "react";
import type { AnimeDetail } from "../../types/anime";
import { fetchAnimeById } from "../../services/animeService";
import { TrailerEmbed } from "../TrailerEmbed/TrailerEmbed";
import { NotesBlock } from "../NotesBlock/NotesBlock";
import { DrawerNav, type DrawerNavProps } from "../DrawerNav/DrawerNav";
import { useDrawerKeys } from "../../hooks/useDrawerKeys";
import styles from "./AnimeDrawer.module.css";
import { CoverImage } from "../CoverImage/CoverImage";
import { DrawerFallback, type DrawerFallbackData } from "../DrawerFallback/DrawerFallback";

// notes/onNotesChange só vêm quando o item está na biblioteca — no catálogo o
// bloco de anotação não aparece.
interface AnimeDrawerProps {
  animeId: number;
  onClose: () => void;
  onAnimeLoad?: (anime: AnimeDetail) => void;
  // Navegação entre os itens da coleção, sem fechar o drawer.
  nav?: DrawerNavProps;
  // Dados salvos na biblioteca, usados quando nem a API externa nem o cache dela
  // responderem (offline sem o item nunca aberto).
  fallback?: DrawerFallbackData;
  notes?: string | null;
  onNotesChange?: (notes: string) => void;
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

export function AnimeDrawer({ animeId, onClose, onAnimeLoad, notes, onNotesChange, nav, fallback }: AnimeDrawerProps) {
  // Guardados junto com o id a que pertencem, e loading/error derivados daí:
  // navegar troca o id sem remontar o drawer, e estado solto seguiria falando do
  // item anterior (mostrando-o enquanto busca, ou grudando um erro antigo).
  const [loaded, setLoaded] = useState<{ id: number; data: AnimeDetail } | null>(null);
  const [failedId, setFailedId] = useState<number | null>(null);
  const anime = loaded?.id === animeId ? loaded.data : null;
  const error = failedId === animeId;
  const loading = !anime && !error;

  const onAnimeLoadRef = useRef(onAnimeLoad);
  useEffect(() => {
    onAnimeLoadRef.current = onAnimeLoad;
  });

  useEffect(() => {
    let active = true;
    fetchAnimeById(animeId)
      .then((data) => {
        if (!active) return;
        setLoaded({ id: animeId, data });
        onAnimeLoadRef.current?.(data);
      })
      .catch(() => {
        if (active) setFailedId(animeId);
      });

    return () => {
      active = false;
    };
  }, [animeId]);

  useDrawerKeys(onClose, nav);

  const streamingLinks = anime?.externalLinks.filter((l) => l.type === "STREAMING") ?? [];

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.drawer}>
        <button className={styles.closeButton} onClick={onClose}>✕</button>
        {nav && <DrawerNav {...nav} />}

        {loading ? (
          <div className={styles.loading}>Carregando...</div>
        ) : anime ? (
          <>
            <CoverImage
              className={styles.banner}
              src={anime.bannerImage}
              alt=""
              eager
              fallback={<div className={styles.bannerPlaceholder} />}
            />

            <div className={styles.header}>
              <CoverImage className={styles.coverImage} src={anime.coverImage} alt={anime.title} eager />
              <div className={styles.headerInfo}>
                <div className={styles.title}>{anime.title}</div>
                {anime.studios.length > 0 && (
                  <div className={styles.studios}>{anime.studios.join(" · ")}</div>
                )}
              </div>
            </div>

            <div className={styles.content}>
              {anime.trailer && anime.trailer.site === "youtube" && (
                <TrailerEmbed
                  youtubeId={anime.trailer.id}
                  overlay={nav && <DrawerNav {...nav} variant="float" />}
                  autoPlay
                />
              )}

              {anime.description && (
                <div
                  className={styles.description}
                  dangerouslySetInnerHTML={{ __html: anime.description.replace(/<br\s*\/?>/g, " ") }}
                />
              )}

              <div className={styles.infoGrid}>
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
                      ? `★ ${(anime.averageScore / 10).toFixed(1)}${anime.ratingCount ? ` (${anime.ratingCount.toLocaleString('pt-BR')})` : ''}` 
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

              {onNotesChange && <NotesBlock key={animeId} value={notes ?? null} onSave={onNotesChange} />}
            </div>
          </>
        ) : error && fallback ? (
          <DrawerFallback
            {...fallback}
            notes={notes}
            onNotesChange={onNotesChange}
            notesKey={animeId}
          />
        ) : (
          <div className={styles.loading}>{error ? "Erro ao carregar detalhes." : ""}</div>
        )}
      </div>
    </>
  );
}
