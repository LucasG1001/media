import type { YoutubeLibraryEntry, YoutubeLibraryStatus } from "../../types/youtubeLibrary";
import { YOUTUBE_LIBRARY_STATUS_LABELS } from "../../types/youtubeLibrary";
import { LibraryModalBase } from "../LibraryModalBase/LibraryModalBase";

// Coleção e capa são opcionais: a página de Música reusa o modal e lá elas não existem.
type YoutubeModalEntry = Pick<YoutubeLibraryEntry, "id" | "title" | "thumbnail" | "status" | "score" | "lastAccessAt"> &
  Partial<Pick<YoutubeLibraryEntry, "collectionId" | "isCover">>;

interface YoutubeLibraryModalProps {
  entry: YoutubeModalEntry;
  onClose: () => void;
  onSave: (id: string, data: { status: YoutubeLibraryStatus; score: number }) => void;
  onRemove: (id: string) => void;
  onSetCover?: (id: string) => void;
}

export function YoutubeLibraryModal({ entry, onClose, onSave, onRemove, onSetCover }: YoutubeLibraryModalProps) {
  return (
    <LibraryModalBase
      title={entry.title}
      coverImage={entry.thumbnail}
      placeholder="▶️"
      statusLabels={YOUTUBE_LIBRARY_STATUS_LABELS}
      initialStatus={entry.status}
      initialScore={entry.score}
      hasEntry
      canSetCover={!!onSetCover && entry.collectionId != null}
      isCover={entry.isCover ?? false}
      lastAccess={{ label: "Último acesso", at: entry.lastAccessAt }}
      onSetCover={onSetCover ? () => onSetCover(entry.id) : undefined}
      onClose={onClose}
      onSave={(data) =>
        onSave(entry.id, {
          status: data.status as YoutubeLibraryStatus,
          score: data.score,
        })
      }
      onRemove={() => onRemove(entry.id)}
    />
  );
}
