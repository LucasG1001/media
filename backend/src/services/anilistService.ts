import axios from "axios";
import { cachedRequest } from "../lib/httpClient.js";
import { createRateLimiter } from "../lib/rateLimiter.js";
import { chunk } from "../lib/chunk.js";
import type { AniListAnime, AniListResponse, AniListSingleResponse, AniListAiringResponse, AniListAiredEpisode, AnimeCard, AnimeDetail, AniListExternalLink, AniListFuzzyDate, AniListFranchiseNode, AniListFranchiseResponse } from "../types/anime.js";

export class AniListError extends Error {
  constructor(message: string, readonly status: number, options?: ErrorOptions) {
    super(message, options);
    this.name = "AniListError";
  }
}

interface GraphQLEnvelope {
  data: unknown;
  errors?: Array<{ message?: string; status?: number }>;
}

const ANILIST_URL = "https://graphql.anilist.co";
const CACHE_TTL_MS = 60 * 60 * 1000;
const ANILIST_MAX_RETRIES = 4;

const anilistLimiter = createRateLimiter({
  minIntervalMs: 2000,
  lowRemainingThreshold: 5,
  bufferMs: 500,
});

const FRANCHISE_RELATIONS = new Set(["SEQUEL", "PREQUEL", "PARENT", "SIDE_STORY"]);
const FRANCHISE_NODE_CAP = 50;

const MEDIA_FIELDS = `
  id
  title { romaji english native }
  coverImage { large extraLarge }
  bannerImage
  description(asHtml: false)
  status
  format
  episodes
  genres
  studios(isMain: true) { nodes { name } }
  season
  seasonYear
  averageScore
  trailer { id site }
  nextAiringEpisode { episode airingAt }
  endDate { year month day }
  externalLinks { url site icon color type }
`;

// A AniList devolve endDate com partes nulas (anime em exibição, data
// desconhecida ou só o ano). Sem dia e mês exatos não dá para dizer "terminou
// em tal data", então só a data completa vira valor.
function toIsoDate(date: AniListFuzzyDate | null | undefined): string | null {
  if (!date || !date.year || !date.month || !date.day) return null;
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  return `${date.year}-${month}-${day}`;
}

function getStreamingLinks(links: AniListExternalLink[]): AniListExternalLink[] {
  return links.filter((link) => link.type === "STREAMING");
}

function toAnimeCard(anime: AniListAnime): AnimeCard {
  return {
    id: anime.id,
    title: anime.title.english || anime.title.romaji,
    coverImage: anime.coverImage.extraLarge || anime.coverImage.large,
    status: anime.status,
    format: anime.format,
    episodes: anime.episodes,
    averageScore: anime.averageScore,
    season: anime.season,
    seasonYear: anime.seasonYear,
    genres: anime.genres,
    nextAiringEpisode: anime.nextAiringEpisode,
    endDate: toIsoDate(anime.endDate),
    streamingLinks: getStreamingLinks(anime.externalLinks || []),
  };
}

function toAnimeDetail(anime: AniListAnime): AnimeDetail {
  return {
    ...toAnimeCard(anime),
    bannerImage: anime.bannerImage,
    description: anime.description,
    studios: anime.studios.nodes.map((s) => s.name),
    trailer: anime.trailer,
    externalLinks: anime.externalLinks || [],
    streamingEpisodes: anime.streamingEpisodes ?? [],
  };
}

export function getCurrentSeason(): { season: string; year: number } {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  if (month >= 1 && month <= 3) return { season: "WINTER", year };
  if (month >= 4 && month <= 6) return { season: "SPRING", year };
  if (month >= 7 && month <= 9) return { season: "SUMMER", year };
  return { season: "FALL", year };
}

function getNextSeason(): { season: string; year: number } {
  const current = getCurrentSeason();
  const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const currentIndex = seasons.indexOf(current.season);
  const nextIndex = (currentIndex + 1) % 4;
  const nextYear = nextIndex === 0 ? current.year + 1 : current.year;
  return { season: seasons[nextIndex], year: nextYear };
}

async function queryAniList<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  let result: T;
  try {
    result = await cachedRequest<T>(
      {
        method: "post",
        url: ANILIST_URL,
        data: { query, variables },
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "StashAnimeTracker/1.0 (+contato)",
        },
      },
      CACHE_TTL_MS,
      { limiter: anilistLimiter, maxRetries: ANILIST_MAX_RETRIES },
    );
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 404) throw new AniListError("Anime não encontrado na AniList.", 404, { cause: error });
      if (status === 400) throw new AniListError("Requisição inválida à AniList.", 400, { cause: error });
      if (status === 403) throw new AniListError("A AniList desativou temporariamente a API.", 503, { cause: error });
      throw new AniListError("Falha ao consultar a AniList.", 502, { cause: error });
    }
    throw error;
  }

  const envelope = result as GraphQLEnvelope;
  if (envelope.errors?.length) {
    const notFound = envelope.errors.some((e) => e.status === 404);
    const raw = envelope.errors.map((e) => e.message).filter(Boolean).join(" | ");
    throw new AniListError(
      notFound ? "Anime não encontrado na AniList." : "Requisição inválida à AniList.",
      notFound ? 404 : 400,
      raw ? { cause: new Error(raw) } : undefined,
    );
  }
  if (envelope.data == null) throw new AniListError("Requisição inválida à AniList.", 400);

  return result;
}

export async function fetchSeasonAnimes(season: string, year: number, page = 1, perPage = 20): Promise<{ animes: AnimeCard[]; pageInfo: AniListResponse["data"]["Page"]["pageInfo"] }> {

  const query = `
    query ($page: Int, $perPage: Int, $season: MediaSeason, $seasonYear: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;

  const data = await queryAniList<AniListResponse>(query, { page, perPage, season, seasonYear: year });
  return {
    animes: data.data.Page.media.map(toAnimeCard),
    pageInfo: data.data.Page.pageInfo,
  };
}

export async function fetchPopularAnimes(page = 1, year?: number, perPage = 20): Promise<{ animes: AnimeCard[]; pageInfo: AniListResponse["data"]["Page"]["pageInfo"] }> {
  const query = `
    query ($page: Int, $perPage: Int, $seasonYear: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;

  const data = await queryAniList<AniListResponse>(query, { page, perPage, seasonYear: year });
  return {
    animes: data.data.Page.media.map(toAnimeCard),
    pageInfo: data.data.Page.pageInfo,
  };
}

export async function searchAnimes(searchQuery: string, page = 1, perPage = 20): Promise<{ animes: AnimeCard[]; pageInfo: AniListResponse["data"]["Page"]["pageInfo"] }> {
  const query = `
    query ($page: Int, $perPage: Int, $search: String) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;

  const data = await queryAniList<AniListResponse>(query, { page, perPage, search: searchQuery });
  return {
    animes: data.data.Page.media.map(toAnimeCard),
    pageInfo: data.data.Page.pageInfo,
  };
}

export async function fetchAnimesByIds(ids: number[]): Promise<AnimeCard[]> {
  if (ids.length === 0) return [];

  const query = `
    query ($ids: [Int], $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage }
        media(id_in: $ids, type: ANIME) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;

  const results: AnimeCard[] = [];

  for (const batch of chunk(ids, 50)) {
    const data = await queryAniList<AniListResponse>(query, { ids: batch, page: 1, perPage: batch.length });
    results.push(...data.data.Page.media.map(toAnimeCard));
  }

  return results;
}

// Janela de busca do último episódio exibido. Curta de propósito: o refresh de
// anime em exibição roda de hora em hora, então basta cobrir o intervalo entre
// episódios. Janela longa faria um anime de exibição semanal devolver dezenas de
// entradas e empurrar os outros para fora da página.
const AIRED_WINDOW_DAYS = 30;
// Com a janela acima, um lote deste tamanho cabe folgado numa página.
const AIRED_CHUNK_SIZE = 25;
const AIRED_MAX_PAGES = 3;

// Último episódio já exibido de cada anime. O nextAiringEpisode do Media diz o
// que vem, não o que passou, e a data do anterior não é dedutível (nem toda
// exibição é semanal) — daí a consulta separada ao airingSchedules.
//
// Os resultados vêm ordenados por tempo decrescente, então a PRIMEIRA ocorrência
// de cada mediaId já é o episódio mais recente dele. Anime sem episódio na
// janela simplesmente não entra no mapa e mantém o valor guardado.
export async function fetchLastAiredEpisodes(
  ids: number[]
): Promise<Map<number, AniListAiredEpisode>> {
  const latest = new Map<number, AniListAiredEpisode>();
  if (ids.length === 0) return latest;

  const query = `
    query ($ids: [Int], $since: Int, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage }
        airingSchedules(mediaId_in: $ids, airingAt_greater: $since, notYetAired: false, sort: TIME_DESC) {
          mediaId
          episode
          airingAt
        }
      }
    }
  `;

  const since = Math.floor(Date.now() / 1000) - AIRED_WINDOW_DAYS * 86400;

  for (const batch of chunk(ids, AIRED_CHUNK_SIZE)) {
    const pending = new Set(batch);
    for (let page = 1; page <= AIRED_MAX_PAGES && pending.size > 0; page += 1) {
      const data = await queryAniList<AniListAiringResponse>(query, {
        ids: batch,
        since,
        page,
        perPage: 50,
      });
      for (const node of data.data.Page.airingSchedules) {
        if (!pending.has(node.mediaId)) continue;
        pending.delete(node.mediaId);
        latest.set(node.mediaId, { episode: node.episode, airingAt: node.airingAt });
      }
      if (!data.data.Page.pageInfo.hasNextPage) break;
    }
  }

  return latest;
}

export async function fetchAnimeById(id: number): Promise<AnimeDetail> {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        ${MEDIA_FIELDS}
        streamingEpisodes {
          title
          thumbnail
          url
          site
        }
        stats {
          scoreDistribution {
            amount
          }
        }
      }
    }
  `;

  const data = await queryAniList<AniListSingleResponse>(query, { id });
  const anime = data.data.Media;
  if (!anime) throw new AniListError("Anime não encontrado na AniList.", 404);
  const total = anime.stats?.scoreDistribution?.reduce((acc, curr) => acc + curr.amount, 0);
  const ratingCount = total !== undefined && total > 0 ? total : undefined;

  return {
    ...toAnimeDetail(anime),
    ratingCount,
  };
}

function franchiseNodeToCard(node: AniListFranchiseNode): AnimeCard {
  return {
    id: node.id,
    title: node.title.english || node.title.romaji,
    coverImage: node.coverImage.extraLarge || node.coverImage.large,
    status: node.status,
    format: node.format,
    episodes: node.episodes,
    averageScore: null,
    season: null,
    seasonYear: node.seasonYear,
    genres: [],
    nextAiringEpisode: node.nextAiringEpisode,
    endDate: toIsoDate(node.endDate),
    streamingLinks: getStreamingLinks(node.externalLinks || []),
  };
}

export async function discoverFranchise(seedId: number): Promise<AnimeCard[]> {
  const query = `
    query ($ids: [Int], $perPage: Int) {
      Page(perPage: $perPage) {
        media(id_in: $ids, type: ANIME) {
          id
          format
          title { romaji english native }
          coverImage { large extraLarge }
          episodes
          status
          seasonYear
          nextAiringEpisode { episode airingAt }
          endDate { year month day }
          externalLinks { url site icon color type }
          relations { edges { relationType node { id type format } } }
        }
      }
    }
  `;

  const visited = new Map<number, AniListFranchiseNode>();
  let frontier = new Set<number>([seedId]);

  while (frontier.size > 0 && visited.size < FRANCHISE_NODE_CAP) {
    const next = new Set<number>();

    for (const batch of chunk([...frontier].sort((a, b) => a - b), 50)) {
      const data = await queryAniList<AniListFranchiseResponse>(query, { ids: batch, perPage: batch.length });

      for (const node of data.data.Page.media) {
        if (!visited.has(node.id)) visited.set(node.id, node);
      }

      for (const node of data.data.Page.media) {
        for (const edge of node.relations.edges) {
          if (
            FRANCHISE_RELATIONS.has(edge.relationType) &&
            edge.node.type === "ANIME" &&
            !visited.has(edge.node.id) &&
            !frontier.has(edge.node.id)
          ) {
            next.add(edge.node.id);
          }
        }
      }
    }

    frontier = next;
  }

  return [...visited.values()].sort((a, b) => a.id - b.id).map(franchiseNodeToCard);
}
