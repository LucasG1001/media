import type { MovieDetail } from "../../types/movie";
import type { MovieLibraryEntry } from "../../types/movieLibrary";
import { MOVIE_LIBRARY_STATUS_LABELS } from "../../types/movieLibrary";
import { useMovieDetail } from "../../hooks/useMediaDetail";
import { yearOf } from "../../utils/collectionWatch";
import { formatRuntime } from "../../utils/formatRuntime";
import { CollectionWatch, type WatchConfig, type WatchListProps } from "../CollectionWatch/CollectionWatch";
import { MovieDetailSections } from "../MovieDrawer/MovieDetailSections";

interface MovieWatchProps extends WatchListProps<MovieLibraryEntry> {
  onMovieLoad?: (movie: MovieDetail) => void;
  onNotesChange: (notes: string) => void;
}

const CONFIG: WatchConfig<MovieLibraryEntry> = {
  getCover: (entry) => entry.posterImage,
  getYear: (entry) => yearOf(entry.releaseDate),
  getFacts: (entry) => [entry.runtime ? formatRuntime(entry.runtime) : null],
  getGenres: (entry) => entry.genres,
  getBadge: (entry) => (entry.movieStatus === "UPCOMING" ? "Em breve" : null),
  statusLabel: (entry) => MOVIE_LIBRARY_STATUS_LABELS[entry.status],
  getTotal: (entries) => {
    const minutes = entries.reduce((sum, entry) => sum + (entry.runtime ?? 0), 0);
    return minutes > 0 ? formatRuntime(minutes) : null;
  },
  placeholder: "🎬",
  labels: {
    list: "Coleções",
    exit: "← Todas as coleções",
    collection: "Coleção",
    one: "filme",
    many: "filmes",
    completed: "assistidos",
    accessed: "visto",
    previous: "Filme anterior",
    next: "Próximo filme",
  },
};

// Visão de detalhe da biblioteca de filmes. Palco: trailer → imagem de fundo →
// pôster.
export function MovieWatch({ entry, onMovieLoad, onNotesChange, ...list }: MovieWatchProps) {
  const { movie, loading, error } = useMovieDetail(entry.tmdbId, onMovieLoad);

  return (
    <CollectionWatch
      {...list}
      entry={entry}
      config={CONFIG}
      title={movie?.title ?? entry.title}
      subtitle={movie?.tagline}
      trailerId={movie?.trailerKey}
      stageImage={movie?.backdropImage ?? null}
      loading={loading}
      error={error}
      notes={entry.notes}
      onNotesChange={onNotesChange}
    >
      {movie && <MovieDetailSections movie={movie} wide />}
    </CollectionWatch>
  );
}
