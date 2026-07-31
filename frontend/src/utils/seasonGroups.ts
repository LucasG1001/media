import type { CollectionGroup } from "./buildCollectionGroups";
import type { SeriesLibraryEntry } from "../types/seriesLibrary";
import { averageScore } from "./librarySort";

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
  airDate: string | null;
  episodeCount: number | null;
  // Anotação do usuário. Só nos membros temporada — a série não tem anotação.
  notes: string | null;
  // Última vez assistida. Nos membros temporada vem do season_states; no
  // representante e no fallback sem temporadas, da coluna da série.
  lastAccessAt: string | null;
  // Nos membros temporada: indica se é a capa da coleção.
  isCover?: boolean;
  // Só no representante: indica se há temporadas reais.
  hasSeasons?: boolean;
  // Série de temporada única: o card representa a série (nome + capa) mas o
  // estado é o da única temporada. Não é coleção — vira card simples.
  isOnlySeason?: boolean;
}

export type SeasonGroup = CollectionGroup<SeasonMember>;

export function seasonDateOf(member: SeasonMember): number {
  return member.airDate ? new Date(member.airDate).getTime() : Number.POSITIVE_INFINITY;
}

function seriesRepresentative(
  entry: SeriesLibraryEntry,
  hasSeasons: boolean,
  coverPoster: string | null,
  score: number
): SeasonMember {
  return {
    id: `series-${entry.tmdbId}`,
    kind: "series",
    tmdbId: entry.tmdbId,
    seasonNumber: null,
    title: entry.title,
    // Capa da coleção = pôster da temporada escolhida (cover_season), senão da série.
    poster: coverPoster ?? entry.posterImage,
    // Nota da série = média das temporadas avaliadas. Nunca a coluna `score` da
    // linha, que pode ter nota legada de antes das temporadas (viraria "nota
    // fantasma" em série sem temporada avaliada).
    score,
    status: entry.status,
    airDate: entry.firstAirDate,
    episodeCount: entry.episodes,
    notes: null,
    lastAccessAt: entry.lastAccessAt,
    hasSeasons,
  };
}

// Estado padrão de uma temporada ainda não avaliada.
const DEFAULT_STATE = { status: "plan_to_watch", score: 0, notes: null, lastAccessAt: null };

// Uma coleção por série: representante = a série (capa + nome), membros = as
// temporadas (cada uma com status e nota próprios). Só é coleção com
// 2+ temporadas: com 1 temporada o grupo vira card simples que mostra a série mas
// carrega o estado daquela temporada (`isOnlySeason`), e séries sem season_list
// caem no fallback de 1 membro (a própria série).
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
    const seasonMembers: SeasonMember[] = seasons.map((s) => {
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
        airDate: s.airDate,
        episodeCount: s.episodeCount,
        notes: st.notes ?? null,
        lastAccessAt: st.lastAccessAt ?? null,
        isCover: entry.coverSeason === s.number,
      };
    });

    const representative = seriesRepresentative(
      entry,
      hasSeasons,
      coverPoster,
      averageScore(seasonMembers)
    );

    const allMembers: SeasonMember[] = hasSeasons ? seasonMembers : [representative];

    // Temporada única: um card só, com nome e capa da série e o estado da temporada.
    const single: SeasonMember | null = allMembers.length === 1 && hasSeasons
      ? {
          ...allMembers[0],
          title: entry.title,
          poster: coverPoster ?? allMembers[0].poster,
          airDate: allMembers[0].airDate ?? entry.firstAirDate,
          isOnlySeason: true,
        }
      : null;
    const members = single ? [single] : allMembers;

    const shown = memberFilter ? members.filter(memberFilter) : members;
    if (shown.length === 0) continue;

    if (!single) lookup.set(representative.id, representative);
    for (const m of shown) lookup.set(m.id, m);

    groups.push({
      key: `series-${entry.tmdbId}`,
      representative: single ?? representative,
      members: shown,
      count: members.length,
      completedCount: shown.length,
    });
  }

  return { groups, lookup };
}
