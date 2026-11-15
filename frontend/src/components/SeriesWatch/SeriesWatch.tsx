import type { SeriesDetail } from "../../types/series";
import type { SeriesLibraryStatus } from "../../types/seriesLibrary";
import { SERIES_LIBRARY_STATUS_LABELS } from "../../types/seriesLibrary";
import type { SeasonMember } from "../../utils/seasonGroups";
import { findGroupOf } from "../../utils/collectionWatch";
import { useSeasonDetail } from "../../hooks/useMediaDetail";
import { CollectionWatch, type WatchConfig, type WatchListProps } from "../CollectionWatch/CollectionWatch";
import { SeriesDetailSections } from "../SeriesDrawer/SeriesDetailSections";
import { SeasonEpisodes } from "../SeasonDrawer/SeasonEpisodes";

interface SeriesWatchProps extends WatchListProps<SeasonMember> {
  onSeriesLoad?: (series: SeriesDetail) => void;
  // A anotação é da temporada: a página só passa quando o item aberto é uma.
  onNotesChange?: (notes: string) => void;
}

function statusLabel(member: SeasonMember): string {
  return SERIES_LIBRARY_STATUS_LABELS[member.status as SeriesLibraryStatus] ?? member.status;
}

const CONFIG: WatchConfig<SeasonMember> = {
  getCover: (member) => member.poster,
  getMeta: (member) => `${member.airDate ? `${member.airDate.slice(0, 4)} · ` : ""}${statusLabel(member)}`,
  placeholder: "📺",
  labels: {
    list: "Séries",
    exit: "← Todas as séries",
    collection: "Série",
    one: "temporada",
    many: "temporadas",
    previous: "Temporada anterior",
    next: "Próxima temporada",
  },
};

// Visão de detalhe da biblioteca de séries. A coleção são as temporadas: a lista
// mostra as séries e, dentro de uma, as temporadas dela. Os dados do palco são os
// da série (o TMDB não dá trailer por temporada); da temporada vêm o pôster, a
// sinopse e os episódios. O item aberto é quase sempre uma temporada — série sem
// `season_list` é o único caso em que é a própria série, sem episódios nem
// anotação.
export function SeriesWatch({ entry, onSeriesLoad, onNotesChange, ...list }: SeriesWatchProps) {
  const isSeason = entry.kind === "season" && entry.seasonNumber != null;
  const { series, season, loading, error } = useSeasonDetail(
    entry.tmdbId,
    isSeason ? entry.seasonNumber : null,
    onSeriesLoad
  );

  // O título do palco é o da série. Numa temporada de coleção ele não está no
  // membro ("Temporada 2"), e sim no representante do grupo.
  const seriesTitle = series?.title ?? findGroupOf(list.groups, entry.id)?.representative.title ?? entry.title;
  const seasonLabel = season?.name || (entry.isOnlySeason ? `Temporada ${entry.seasonNumber}` : entry.title);

  return (
    <CollectionWatch
      {...list}
      entry={entry}
      config={CONFIG}
      title={seriesTitle}
      subtitle={isSeason ? seasonLabel : series?.tagline}
      statusLabel={statusLabel(entry)}
      trailerId={series?.trailerKey}
      stageImage={series?.backdropImage ?? null}
      loading={loading}
      error={error}
      notes={entry.notes}
      onNotesChange={isSeason ? onNotesChange : undefined}
    >
      {series && (
        <>
          <SeriesDetailSections series={series} overview={season?.overview} wide />
          {season && <SeasonEpisodes episodes={season.episodes} />}
        </>
      )}
    </CollectionWatch>
  );
}
