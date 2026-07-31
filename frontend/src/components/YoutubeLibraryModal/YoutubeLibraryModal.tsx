import type { YoutubeLibraryEntry, YoutubeLibraryStatus } from "../../types/youtubeLibrary";
import { YOUTUBE_LIBRARY_STATUS_LABELS } from "../../types/youtubeLibrary";
import { LibraryModalBase } from "../LibraryModalBase/LibraryModalBase";

interface YoutubeLibraryModalProps {
  entry: YoutubeLibraryEntry;
  onClose: () => void;
  onSave: (id: string, data: { status: YoutubeLibraryStatus; score: number }) => void;
  onRemove: (id: string) => void;
  onSetCover: (id: string) => void;
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
      canSetCover={entry.collectionId != null}
      isCover={entry.isCover}
      lastAccess={{ label: "Último acesso", at: entry.lastAccessAt }}
      onSetCover={() => onSetCover(entry.id)}
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
