import type { MovieDetail } from "../../types/movie";
import type { MovieLibraryEntry } from "../../types/movieLibrary";
import { MOVIE_LIBRARY_STATUS_LABELS } from "../../types/movieLibrary";
import { useMovieDetail } from "../../hooks/useMediaDetail";
import { CollectionWatch, type WatchConfig, type WatchListProps } from "../CollectionWatch/CollectionWatch";
import { MovieDetailSections } from "../MovieDrawer/MovieDetailSections";

interface MovieWatchProps extends WatchListProps<MovieLibraryEntry> {
  onMovieLoad?: (movie: MovieDetail) => void;
  onNotesChange: (notes: string) => void;
}

const CONFIG: WatchConfig<MovieLibraryEntry> = {
  getCover: (entry) => entry.posterImage,
  getMeta: (entry) =>
    `${entry.releaseDate ? `${entry.releaseDate.slice(0, 4)} · ` : ""}${MOVIE_LIBRARY_STATUS_LABELS[entry.status]}`,
  placeholder: "🎬",
  labels: {
    list: "Coleções",
    exit: "← Todas as coleções",
    collection: "Coleção",
    one: "filme",
    many: "filmes",
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
      statusLabel={MOVIE_LIBRARY_STATUS_LABELS[entry.status]}
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
