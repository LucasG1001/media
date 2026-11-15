import type { GameDetail } from "../../types/game";
import type { GameLibraryEntry } from "../../types/gameLibrary";
import { GAME_LIBRARY_STATUS_LABELS } from "../../types/gameLibrary";
import { useGameDetail } from "../../hooks/useMediaDetail";
import { CollectionWatch, type WatchConfig, type WatchListProps } from "../CollectionWatch/CollectionWatch";
import { GameDetailSections } from "../GameDetailSections/GameDetailSections";

interface GameWatchProps extends WatchListProps<GameLibraryEntry> {
  onGameLoad?: (game: GameDetail) => void;
  onNotesChange: (notes: string) => void;
}

const CONFIG: WatchConfig<GameLibraryEntry> = {
  getCover: (entry) => entry.backgroundImage,
  getMeta: (entry) =>
    `${entry.released ? `${entry.released.slice(0, 4)} · ` : ""}${GAME_LIBRARY_STATUS_LABELS[entry.status]}`,
  placeholder: "🎮",
  labels: {
    list: "Coleções",
    exit: "← Todas as coleções",
    collection: "Coleção",
    one: "jogo",
    many: "jogos",
    previous: "Jogo anterior",
    next: "Próximo jogo",
  },
};

// Visão de detalhe da biblioteca de jogos. Palco: trailer → banner ou primeira
// screenshot → capa.
export function GameWatch({ entry, onGameLoad, onNotesChange, ...list }: GameWatchProps) {
  const { game, loading, error } = useGameDetail(entry.igdbId, onGameLoad);

  return (
    <CollectionWatch
      {...list}
      entry={entry}
      config={CONFIG}
      title={game?.title ?? entry.title}
      subtitle={game && game.developers.length > 0 ? game.developers.join(" · ") : null}
      statusLabel={GAME_LIBRARY_STATUS_LABELS[entry.status]}
      trailerId={game?.trailer?.youtubeId}
      stageImage={game ? (game.bannerImage ?? game.screenshots[0] ?? null) : null}
      loading={loading}
      error={error}
      notes={entry.notes}
      onNotesChange={onNotesChange}
    >
      {game && <GameDetailSections game={game} wide />}
    </CollectionWatch>
  );
}
