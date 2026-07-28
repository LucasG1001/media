import type { SeriesCard } from "../../types/series";
import type { SeriesLibraryEntry, SeriesLibraryStatus } from "../../types/seriesLibrary";
import { SERIES_LIBRARY_STATUS_LABELS } from "../../types/seriesLibrary";
import { LibraryModalBase } from "../LibraryModalBase/LibraryModalBase";

interface SeriesLibraryModalProps {
  series: SeriesCard;
  libraryEntry: SeriesLibraryEntry | undefined;
  onClose: () => void;
  onSave: (series: SeriesCard, data: { status: SeriesLibraryStatus; isRewatching: boolean }) => void;
  onRemove: (id: string) => void;
}

export function SeriesLibraryModal({ series, libraryEntry, onClose, onSave, onRemove }: SeriesLibraryModalProps) {
  // Sem nota aqui: a nota da série é a média das temporadas (dada clicando na
  // capa de cada temporada na biblioteca).
  return (
    <LibraryModalBase
      title={series.title}
      coverImage={series.posterImage}
      placeholder="📺"
      statusLabels={SERIES_LIBRARY_STATUS_LABELS}
      initialStatus={libraryEntry?.status ?? "plan_to_watch"}
      initialScore={0}
      hideScore
      hasEntry={!!libraryEntry}
      rewatch={{ label: "Reassistindo", whenStatus: "watched", initial: libraryEntry?.isRewatching ?? false }}
      onClose={onClose}
      onSave={(data) => onSave(series, { status: data.status as SeriesLibraryStatus, isRewatching: data.rewatching ?? false })}
      onRemove={() => libraryEntry && onRemove(libraryEntry.id)}
    />
  );
}
