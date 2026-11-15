import type { AnimeDetail } from "../../types/anime";
import type { LibraryEntry } from "../../types/library";
import { LIBRARY_STATUS_LABELS } from "../../types/library";
import { useAnimeDetail } from "../../hooks/useMediaDetail";
import { episodesLabel } from "../../utils/collectionWatch";
import { CollectionWatch, type WatchConfig, type WatchListProps } from "../CollectionWatch/CollectionWatch";
import { AnimeDetailSections } from "../AnimeDrawer/AnimeDetailSections";

interface AnimeWatchProps extends WatchListProps<LibraryEntry> {
  onAnimeLoad?: (anime: AnimeDetail) => void;
  onNotesChange: (notes: string) => void;
}

// Formatos da AniList como aparecem na lista.
const FORMAT_LABELS: Record<string, string> = {
  TV: "TV",
  TV_SHORT: "TV curto",
  MOVIE: "Filme",
  SPECIAL: "Especial",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Clipe",
};

const AIRING_LABELS: Record<string, string> = {
  RELEASING: "Em exibição",
  NOT_YET_RELEASED: "Em breve",
};

const CONFIG: WatchConfig<LibraryEntry> = {
  getCover: (entry) => entry.coverImage,
  getYear: (entry) => entry.seasonYear,
  getFacts: (entry) => [
    entry.format ? (FORMAT_LABELS[entry.format] ?? entry.format) : null,
    episodesLabel(entry.totalEpisodes),
  ],
  getGenres: (entry) => entry.genres,
  getBadge: (entry) => (entry.animeStatus ? (AIRING_LABELS[entry.animeStatus] ?? null) : null),
  statusLabel: (entry) => LIBRARY_STATUS_LABELS[entry.status],
  getTotal: (entries) => episodesLabel(entries.reduce((sum, entry) => sum + (entry.totalEpisodes ?? 0), 0)),
  placeholder: "🎬",
  labels: {
    list: "Franquias",
    exit: "← Todas as franquias",
    collection: "Franquia",
    one: "título",
    many: "títulos",
    completed: "assistidos",
    accessed: "visto",
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
