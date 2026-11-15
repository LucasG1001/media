import type { GameDetail } from "../../types/game";
import type { GameLibraryEntry } from "../../types/gameLibrary";
import { GAME_LIBRARY_STATUS_LABELS, GAME_MODE_LABELS, type GameMode } from "../../types/gameLibrary";
import { useGameDetail } from "../../hooks/useMediaDetail";
import { yearOf } from "../../utils/collectionWatch";
import { CollectionWatch, type WatchConfig, type WatchListProps } from "../CollectionWatch/CollectionWatch";
import { GameDetailSections } from "../GameDetailSections/GameDetailSections";

interface GameWatchProps extends WatchListProps<GameLibraryEntry> {
  onGameLoad?: (game: GameDetail) => void;
  onNotesChange: (notes: string) => void;
}

// Quantos modos de jogo entram na linha de fatos: com todos ela não cabe.
const MODE_LIMIT = 2;

function modesLabel(modes: string[] | null): string | null {
  const labels = (modes ?? []).slice(0, MODE_LIMIT).map((mode) => GAME_MODE_LABELS[mode as GameMode] ?? mode);
  return labels.length > 0 ? labels.join(", ") : null;
}

const CONFIG: WatchConfig<GameLibraryEntry> = {
  getCover: (entry) => entry.backgroundImage,
  getYear: (entry) => yearOf(entry.released),
  getFacts: (entry) => [entry.metacritic ? `Metacritic ${entry.metacritic}` : null, modesLabel(entry.gameModes)],
  getGenres: (entry) => entry.genres,
  getBadge: (entry) => (entry.gameStatus === "UPCOMING" ? "Em breve" : null),
  statusLabel: (entry) => GAME_LIBRARY_STATUS_LABELS[entry.status],
  placeholder: "🎮",
  labels: {
    list: "Coleções",
    collection: "Coleção",
    many: "jogos",
    completed: "zerados",
    accessed: "jogado",
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
