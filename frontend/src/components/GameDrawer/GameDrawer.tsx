import type { GameDetail } from "../../types/game";
import { useGameDetail } from "../../hooks/useGameDetail";
import { GameDetailSections } from "../GameDetailSections/GameDetailSections";
import { TrailerEmbed } from "../TrailerEmbed/TrailerEmbed";
import { NotesBlock } from "../NotesBlock/NotesBlock";
import { DrawerNav, type DrawerNavProps } from "../DrawerNav/DrawerNav";
import { useDrawerKeys } from "../../hooks/useDrawerKeys";
import styles from "./GameDrawer.module.css";
import { CoverImage } from "../CoverImage/CoverImage";
import { DrawerFallback, type DrawerFallbackData } from "../DrawerFallback/DrawerFallback";

// notes/onNotesChange só vêm quando o item está na biblioteca — no catálogo o
// bloco de anotação não aparece.
interface GameDrawerProps {
  gameId: number;
  onClose: () => void;
  onGameLoad?: (game: GameDetail) => void;
  // Navegação entre os itens da coleção, sem fechar o drawer.
  nav?: DrawerNavProps;
  // Dados salvos na biblioteca, usados quando nem a API externa nem o cache dela
  // responderem (offline sem o item nunca aberto).
  fallback?: DrawerFallbackData;
  notes?: string | null;
  onNotesChange?: (notes: string) => void;
}

export function GameDrawer({ gameId, onClose, onGameLoad, notes, onNotesChange, nav, fallback }: GameDrawerProps) {
  // Navegar troca o id sem remontar o drawer; o hook guarda o payload junto com
  // o id a que pertence.
  const { game, loading, error } = useGameDetail(gameId, onGameLoad);

  useDrawerKeys(onClose, nav);

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.drawer}>
        <button className={styles.closeButton} onClick={onClose}>✕</button>
        {nav && <DrawerNav {...nav} />}

        {loading ? (
          <div className={styles.loading}>Carregando...</div>
        ) : game ? (
          <>
            <CoverImage
              className={styles.banner}
              src={game.bannerImage ?? game.screenshots[0] ?? null}
              alt=""
              eager
              fallback={<div className={styles.bannerPlaceholder} />}
            />

            <div className={styles.header}>
              <CoverImage
                className={styles.coverImage}
                src={game.backgroundImage}
                alt={game.title}
                eager
                fallback={<div className={styles.coverPlaceholder}>🎮</div>}
              />
              <div className={styles.headerInfo}>
                <div className={styles.title}>{game.title}</div>
                {game.developers.length > 0 && (
                  <div className={styles.developers}>{game.developers.join(" · ")}</div>
                )}
              </div>
            </div>

            <div className={styles.content}>
              {game.trailer && (
                <TrailerEmbed
                  youtubeId={game.trailer.youtubeId}
                  overlay={nav && <DrawerNav {...nav} variant="float" />}
                  autoPlay
                />
              )}

              <GameDetailSections game={game} />

              {onNotesChange && <NotesBlock key={gameId} value={notes ?? null} onSave={onNotesChange} />}
            </div>
          </>
        ) : error && fallback ? (
          <DrawerFallback
            {...fallback}
            notes={notes}
            onNotesChange={onNotesChange}
            notesKey={gameId}
          />
        ) : (
          <div className={styles.loading}>{error ? "Erro ao carregar detalhes." : ""}</div>
        )}
      </div>
    </>
  );
}
