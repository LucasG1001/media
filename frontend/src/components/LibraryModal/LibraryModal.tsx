import type { AnimeCard } from "../../types/anime";
import type { LibraryEntry, LibraryStatus } from "../../types/library";
import { LIBRARY_STATUS_LABELS } from "../../types/library";
import { LibraryModalBase } from "../LibraryModalBase/LibraryModalBase";

interface LibraryModalProps {
  anime: AnimeCard;
  libraryEntry: LibraryEntry | undefined;
  onClose: () => void;
  onSave: (anime: AnimeCard, data: { status: LibraryStatus; score: number }) => void;
  onRemove: (id: string) => void;
  onSetCover: (id: string) => void;
  onAccessAgain: (id: string) => void;
}

export function LibraryModal({ anime, libraryEntry, onClose, onSave, onRemove, onSetCover, onAccessAgain }: LibraryModalProps) {
  return (
    <LibraryModalBase
      title={anime.title}
      coverImage={anime.coverImage}
      placeholder="🎬"
      statusLabels={LIBRARY_STATUS_LABELS}
      initialStatus={libraryEntry?.status ?? "plan_to_watch"}
      initialScore={libraryEntry?.score ?? 0}
      hasEntry={!!libraryEntry}
      canSetCover={!!libraryEntry && libraryEntry.franchiseId != null}
      isCover={libraryEntry?.isCover ?? false}
      lastAccess={{ label: "Última vez assistido", at: libraryEntry?.lastAccessAt ?? null }}
      again={{ label: "🔁 Assisti de novo", whenStatus: "watched", onClick: () => libraryEntry && onAccessAgain(libraryEntry.id) }}
      onSetCover={() => libraryEntry && onSetCover(libraryEntry.id)}
      onClose={onClose}
      onSave={(data) =>
        onSave(anime, {
          status: data.status as LibraryStatus,
          score: data.score,
        })
      }
      onRemove={() => libraryEntry && onRemove(libraryEntry.id)}
    />
  );
}
