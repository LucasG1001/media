import type { AnimeDetail } from "../../types/anime";
import { useAnimeDetail } from "../../hooks/useMediaDetail";
import { AnimeDetailSections } from "./AnimeDetailSections";
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

export function AnimeDrawer({ animeId, onClose, onAnimeLoad, notes, onNotesChange, nav, fallback }: AnimeDrawerProps) {
  // Navegar troca o id sem remontar o drawer; o hook guarda o payload junto com
  // o id a que pertence.
  const { anime, loading, error } = useAnimeDetail(animeId, onAnimeLoad);

  useDrawerKeys(onClose, nav);

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

              <AnimeDetailSections anime={anime} />

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
