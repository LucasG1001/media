import type { AnimeDetail } from "../../types/anime";
import type { LibraryEntry } from "../../types/library";
import { LIBRARY_STATUS_LABELS } from "../../types/library";
import { useAnimeDetail } from "../../hooks/useMediaDetail";
import { CollectionWatch, type WatchConfig, type WatchListProps } from "../CollectionWatch/CollectionWatch";
import { AnimeDetailSections } from "../AnimeDrawer/AnimeDetailSections";

interface AnimeWatchProps extends WatchListProps<LibraryEntry> {
  onAnimeLoad?: (anime: AnimeDetail) => void;
  onNotesChange: (notes: string) => void;
}

const CONFIG: WatchConfig<LibraryEntry> = {
  getCover: (entry) => entry.coverImage,
  getMeta: (entry) => `${entry.seasonYear ? `${entry.seasonYear} · ` : ""}${LIBRARY_STATUS_LABELS[entry.status]}`,
  placeholder: "🎬",
  labels: {
    list: "Franquias",
    exit: "← Todas as franquias",
    collection: "Franquia",
    one: "título",
    many: "títulos",
    previous: "Título anterior",
    next: "Próximo título",
  },
};

// Visão de detalhe da biblioteca de anime: a lista são as franquias e, dentro
// de uma, as temporadas, OVAs e filmes. Palco: trailer (só os do YouTube) →
// banner → capa.
export function AnimeWatch({ entry, onAnimeLoad, onNotesChange, ...list }: AnimeWatchProps) {
  const { anime, loading, error } = useAnimeDetail(entry.anilistId, onAnimeLoad);

  return (
    <CollectionWatch
      {...list}
      entry={entry}
      config={CONFIG}
      title={anime?.title ?? entry.title}
      subtitle={anime && anime.studios.length > 0 ? anime.studios.join(" · ") : null}
      statusLabel={LIBRARY_STATUS_LABELS[entry.status]}
      trailerId={anime?.trailer?.site === "youtube" ? anime.trailer.id : null}
      stageImage={anime?.bannerImage ?? null}
      loading={loading}
      error={error}
      notes={entry.notes}
      onNotesChange={onNotesChange}
    >
      {anime && <AnimeDetailSections anime={anime} wide />}
    </CollectionWatch>
  );
}
