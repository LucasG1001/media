import type { GameCard } from "../../types/game";
import type { GameLibraryEntry, GameLibraryStatus } from "../../types/gameLibrary";
import { GAME_LIBRARY_STATUS_LABELS } from "../../types/gameLibrary";
import { LibraryModalBase } from "../LibraryModalBase/LibraryModalBase";

interface GameLibraryModalProps {
  game: GameCard;
  libraryEntry: GameLibraryEntry | undefined;
  onClose: () => void;
  onSave: (game: GameCard, data: { status: GameLibraryStatus; score: number }) => void;
  onRemove: (id: string) => void;
  onSetCover: (id: string) => void;
  onAccessAgain: (id: string) => void;
}

export function GameLibraryModal({ game, libraryEntry, onClose, onSave, onRemove, onSetCover, onAccessAgain }: GameLibraryModalProps) {
  return (
    <LibraryModalBase
      title={game.title}
      coverImage={game.backgroundImage}
      placeholder="🎮"
      statusLabels={GAME_LIBRARY_STATUS_LABELS}
      initialStatus={libraryEntry?.status ?? "plan_to_play"}
      initialScore={libraryEntry?.score ?? 0}
      hasEntry={!!libraryEntry}
      canSetCover={!!libraryEntry && libraryEntry.collectionId != null}
      isCover={libraryEntry?.isCover ?? false}
      lastAccess={{ label: "Última vez jogado", at: libraryEntry?.lastAccessAt ?? null }}
      again={{ label: "🔁 Joguei de novo", whenStatus: "beaten", onClick: () => libraryEntry && onAccessAgain(libraryEntry.id) }}
      onSetCover={() => libraryEntry && onSetCover(libraryEntry.id)}
      onClose={onClose}
      onSave={(data) => onSave(game, { status: data.status as GameLibraryStatus, score: data.score })}
      onRemove={() => libraryEntry && onRemove(libraryEntry.id)}
    />
  );
}
