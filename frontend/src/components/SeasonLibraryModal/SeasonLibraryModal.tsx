import type { SeriesLibraryStatus } from "../../types/seriesLibrary";
import { SERIES_LIBRARY_STATUS_LABELS } from "../../types/seriesLibrary";
import { LibraryModalBase } from "../LibraryModalBase/LibraryModalBase";

interface SeasonLibraryModalProps {
  seriesTitle: string;
  seasonNumber: number;
  seasonName: string | null;
  poster: string | null;
  status: SeriesLibraryStatus;
  score: number;
  isRewatching: boolean;
  isCover: boolean;
  onClose: () => void;
  onSave: (data: { status: SeriesLibraryStatus; score: number; isRewatching: boolean }) => void;
  onSetCover: () => void;
}

// Modal de temporada igual ao dos filmes (status + nota + reassistindo + definir
// capa), mas sem "Remover" (temporada não é removida individualmente).
export function SeasonLibraryModal({
  seriesTitle,
  seasonNumber,
  seasonName,
  poster,
  status,
  score,
  isRewatching,
  isCover,
  onClose,
  onSave,
  onSetCover,
}: SeasonLibraryModalProps) {
  return (
    <LibraryModalBase
      title={`${seriesTitle} — ${seasonName || `Temporada ${seasonNumber}`}`}
      coverImage={poster}
      placeholder="📺"
      statusLabels={SERIES_LIBRARY_STATUS_LABELS}
      initialStatus={status}
      initialScore={score}
      hasEntry={false}
      canSetCover
      isCover={isCover}
      onSetCover={onSetCover}
      rewatch={{ label: "Reassistindo", whenStatus: "watched", initial: isRewatching }}
      onClose={onClose}
      onSave={(data) =>
        onSave({
          status: data.status as SeriesLibraryStatus,
          score: data.score,
          isRewatching: data.rewatching ?? false,
        })
      }
      onRemove={() => {}}
    />
  );
}
