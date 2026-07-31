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
  isCover: boolean;
  lastAccessAt: string | null;
  onClose: () => void;
  onSave: (data: { status: SeriesLibraryStatus; score: number }) => void;
  // "Assisti de novo" da temporada.
  onAccessAgain: () => void;
  // Só nas coleções de 2+ temporadas: definir esta como capa.
  onSetCover?: () => void;
  // Só na série de temporada única: remover = remover a série.
  onRemove?: () => void;
}

// Modal de temporada igual ao dos filmes (status + nota + definir capa).
// Temporada de coleção não é removida individualmente — daí o "Remover" aparecer
// só quando a série tem uma única temporada.
export function SeasonLibraryModal({
  seriesTitle,
  seasonNumber,
  seasonName,
  poster,
  status,
  score,
  isCover,
  lastAccessAt,
  onClose,
  onSave,
  onAccessAgain,
  onSetCover,
  onRemove,
}: SeasonLibraryModalProps) {
  return (
    <LibraryModalBase
      title={`${seriesTitle} — ${seasonName || `Temporada ${seasonNumber}`}`}
      coverImage={poster}
      placeholder="📺"
      statusLabels={SERIES_LIBRARY_STATUS_LABELS}
      initialStatus={status}
      initialScore={score}
      hasEntry={!!onRemove}
      canSetCover={!!onSetCover}
      isCover={isCover}
      onSetCover={onSetCover}
      lastAccess={{ label: "Última vez assistida", at: lastAccessAt }}
      again={{ label: "🔁 Assisti de novo", whenStatus: "watched", onClick: onAccessAgain }}
      onClose={onClose}
      onSave={(data) =>
        onSave({
          status: data.status as SeriesLibraryStatus,
          score: data.score,
        })
      }
      onRemove={() => onRemove?.()}
    />
  );
}
