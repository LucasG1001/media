import type { CollectionGroup } from "./buildCollectionGroups";
import type { SeriesLibraryEntry } from "../types/seriesLibrary";

// Membro sintético da "coleção de temporadas". Satisfaz o contrato exigido por
// FranchiseGrid ({ id, status, score, title }); os demais campos alimentam o
// seasonCardConfig e o clique. Não é uma linha do banco.
export interface SeasonMember {
  id: string;
  kind: "series" | "season";
  tmdbId: number;
  seasonNumber: number | null;
  title: string;
  poster: string | null;
  score: number;
  status: string;
  isRewatching: boolean;
  airDate: string | null;
  episodeCount: number | null;
  // Nos membros temporada: indica se é a capa da coleção.
  isCover?: boolean;
  // Só no representante: indica se há temporadas reais (define se vira coleção
  // expansível ou card simples no FranchiseGrid).
  hasSeasons?: boolean;
}

export type SeasonGroup = CollectionGroup<SeasonMember>;

export function seasonDateOf(member: SeasonMember): number {
  return member.airDate ? new Date(member.airDate).getTime() : Number.POSITIVE_INFINITY;
}

function seriesRepresentative(
  entry: SeriesLibraryEntry,
  hasSeasons: boolean,
  coverPoster: string | null
): SeasonMember {
  return {
    id: `series-${entry.tmdbId}`,
    kind: "series",
    tmdbId: entry.tmdbId,
    seasonNumber: null,
    title: entry.title,
    // Capa da coleção = pôster da temporada escolhida (cover_season), senão da série.
    poster: coverPoster ?? entry.posterImage,
    score: entry.score,
    status: entry.status,
    isRewatching: false,
    airDate: entry.firstAirDate,
    episodeCount: entry.episodes,
    hasSeasons,
  };
}

// Estado padrão de uma temporada ainda não avaliada.
const DEFAULT_STATE = { status: "plan_to_watch", score: 0, isRewatching: false };

// Uma coleção por série: representante = a série (capa + nome), membros = as
// temporadas (cada uma com status/nota/reassistindo próprios). Séries sem
// season_list caem no fallback de 1 membro (a própria série), como card simples.
// `memberFilter` (quando presente) reduz aos que batem — total (`count`) não muda.
export function buildSeasonGroups(
  entries: SeriesLibraryEntry[],
  memberFilter?: (member: SeasonMember) => boolean
): {
  groups: SeasonGroup[];
  lookup: Map<string, SeasonMember>;
} {
  const groups: SeasonGroup[] = [];
  const lookup = new Map<string, SeasonMember>();

  for (const entry of entries) {
    const seasons = entry.seasonList ?? [];
    const states = entry.seasonStates ?? {};
    const hasSeasons = seasons.length > 0;
    const coverPoster = entry.coverSeason != null
      ? seasons.find((s) => s.number === entry.coverSeason)?.poster ?? null
      : null;
    const representative = seriesRepresentative(entry, hasSeasons, coverPoster);

    const allMembers: SeasonMember[] = hasSeasons
      ? seasons.map((s) => {
          const st = states[String(s.number)] ?? DEFAULT_STATE;
          return {
            id: `s${entry.tmdbId}-${s.number}`,
            kind: "season" as const,
            tmdbId: entry.tmdbId,
            seasonNumber: s.number,
            title: s.name || `Temporada ${s.number}`,
            poster: s.poster ?? entry.posterImage,
            score: st.score,
            status: st.status,
            isRewatching: st.isRewatching,
            airDate: s.airDate,
            episodeCount: s.episodeCount,
            isCover: entry.coverSeason === s.number,
          };
        })
      : [representative];

    const shown = memberFilter ? allMembers.filter(memberFilter) : allMembers;
    if (shown.length === 0) continue;

    lookup.set(representative.id, representative);
    for (const m of shown) lookup.set(m.id, m);

    groups.push({
      key: `series-${entry.tmdbId}`,
      representative,
      members: shown,
      count: allMembers.length,
      completedCount: shown.length,
    });
  }

  return { groups, lookup };
}
