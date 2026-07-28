import axios from "axios";
import { cachedRequest } from "../lib/httpClient.js";
import { getIgdbToken, getIgdbClientId } from "../lib/igdbAuth.js";
import type {
  IgdbGameListItem,
  IgdbGameDetail,
  IgdbWebsite,
  IgdbCollectionRef,
  IgdbCollection,
  GameCard,
  GameDetail,
  GameListResult,
  GamePageInfo,
  GameStore,
} from "../types/game.js";

const IGDB_URL = "https://api.igdb.com/v4";
const IMAGE_URL = "/api/game/image";
const PAGE_SIZE = 20;
const CACHE_TTL_MS = 60 * 60 * 1000;

const CARD_FIELDS =
  "fields name, cover.image_id, first_release_date, total_rating, aggregated_rating, websites.type;";

const DETAIL_FIELDS =
  "fields name, summary, cover.image_id, screenshots.image_id, videos.video_id, videos.name, " +
  "genres.name, platforms.name, involved_companies.company.name, involved_companies.developer, " +
  "involved_companies.publisher, websites.type, websites.url, external_games.external_game_source, " +
  "external_games.uid, first_release_date, rating, aggregated_rating, total_rating, total_rating_count;";

const STORE_SITES: Record<number, { slug: string; name: string }> = {
  13: { slug: "steam", name: "Steam" },
  16: { slug: "epic", name: "Epic Games" },
  17: { slug: "gog", name: "GOG" },
  15: { slug: "itch", name: "itch.io" },
  22: { slug: "xbox", name: "Xbox" },
  23: { slug: "playstation", name: "PlayStation" },
};

const STEAM_SOURCE = 1;
const OFFICIAL_SITE_TYPE = 1;

// IDs estáveis do enum game_modes da IGDB → slugs canônicos (armazenados no banco).
const GAME_MODE_SLUGS: Record<number, string> = {
  1: "singleplayer",
  2: "multiplayer",
  3: "coop",
  4: "split_screen",
  5: "mmo",
  6: "battle_royale",
};

async function igdbQuery<T>(endpoint: string, body: string): Promise<T> {
  const exec = async (forceRefresh: boolean): Promise<T> => {
    const token = await getIgdbToken(forceRefresh);
    return cachedRequest<T>(
      {
        method: "post",
        url: `${IGDB_URL}/${endpoint}`,
        data: body,
        headers: { "Client-ID": getIgdbClientId(), Authorization: `Bearer ${token}` },
      },
      CACHE_TTL_MS
    );
  };

  try {
    return await exec(false);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return exec(true);
    }
    throw error;
  }
}

function igdbImage(imageId: string, size: string): string {
  return `${IMAGE_URL}/t_${size}/${imageId}.jpg`;
}

function toReleased(unix: number | null | undefined): string | null {
  return unix ? new Date(unix * 1000).toISOString().slice(0, 10) : null;
}

function deriveStatus(unix: number | null | undefined): string {
  if (!unix) return "UPCOMING";
  return unix * 1000 <= Date.now() ? "RELEASED" : "UPCOMING";
}

function storeSlugsFrom(websites: IgdbWebsite[] | undefined): string[] {
  const slugs: string[] = [];
  for (const site of websites ?? []) {
    const store = STORE_SITES[site.type];
    if (store && !slugs.includes(store.slug)) slugs.push(store.slug);
  }
  return slugs;
}

function storesFrom(websites: IgdbWebsite[] | undefined): GameStore[] {
  const stores: GameStore[] = [];
  const seen = new Set<string>();
  for (const site of websites ?? []) {
    const store = STORE_SITES[site.type];
    if (store && site.url && !seen.has(store.slug)) {
      seen.add(store.slug);
      stores.push({ name: store.name, url: site.url, slug: store.slug });
    }
  }
  return stores;
}

function ratingToTen(rating: number | null | undefined): number | null {
  return rating != null ? Math.round(rating) / 10 : null;
}

function toGameCard(game: IgdbGameListItem): GameCard {
  return {
    id: game.id,
    title: game.name,
    backgroundImage: game.cover?.image_id ? igdbImage(game.cover.image_id, "cover_big") : null,
    released: toReleased(game.first_release_date),
    rating: ratingToTen(game.total_rating),
    metacritic: game.aggregated_rating != null ? Math.round(game.aggregated_rating) : null,
    gameStatus: deriveStatus(game.first_release_date),
    storeSlugs: storeSlugsFrom(game.websites),
  };
}

function toPageInfo(games: GameCard[], page: number): GamePageInfo {
  return {
    total: (page - 1) * PAGE_SIZE + games.length,
    currentPage: page,
    hasNextPage: games.length === PAGE_SIZE,
  };
}

function rangeUnix(year: number, month: number | undefined): { start: number; end: number } {
  const start = Math.floor(Date.UTC(year, month ? month - 1 : 0, 1) / 1000);
  const endDate = month ? new Date(Date.UTC(year, month, 0)) : new Date(Date.UTC(year, 11, 31));
  const end = Math.floor(endDate.getTime() / 1000) + 86399;
  return { start, end };
}

export async function fetchPopularGames(
  year: number,
  month: number | undefined,
  page = 1
): Promise<GameListResult> {
  const { start, end } = rangeUnix(year, month);
  const body =
    `${CARD_FIELDS} where first_release_date >= ${start} & first_release_date <= ${end} ` +
    `& game_type = 0 & cover != null & total_rating_count != null; ` +
    `sort total_rating_count desc; limit ${PAGE_SIZE}; offset ${(page - 1) * PAGE_SIZE};`;
  const data = await igdbQuery<IgdbGameListItem[]>("games", body);
  const games = data.map(toGameCard);
  return { games, pageInfo: toPageInfo(games, page) };
}

export async function fetchUpcomingGames(page = 1): Promise<GameListResult> {
  const now = Math.floor(Date.now() / 1000);
  const body =
    `${CARD_FIELDS} where first_release_date > ${now} & game_type = 0 & cover != null & hypes != null; ` +
    `sort hypes desc; limit ${PAGE_SIZE}; offset ${(page - 1) * PAGE_SIZE};`;
  const data = await igdbQuery<IgdbGameListItem[]>("games", body);
  const games = data.map(toGameCard);
  return { games, pageInfo: toPageInfo(games, page) };
}

export async function searchGames(searchQuery: string, page = 1): Promise<GameListResult> {
  const sanitized = searchQuery.replace(/"/g, '\\"');
  const body =
    `search "${sanitized}"; ${CARD_FIELDS} where game_type = 0 & cover != null; ` +
    `limit ${PAGE_SIZE}; offset ${(page - 1) * PAGE_SIZE};`;
  const data = await igdbQuery<IgdbGameListItem[]>("games", body);
  const games = data.map(toGameCard);
  return { games, pageInfo: toPageInfo(games, page) };
}

export async function discoverGameCollection(gameId: number): Promise<{ collectionId: number; members: GameCard[] } | null> {
  const ref = await igdbQuery<IgdbCollectionRef[]>("games", `fields collections; where id = ${gameId};`);
  const collectionId = ref[0]?.collections?.[0];
  if (!collectionId) return null;

  const data = await igdbQuery<IgdbCollection[]>(
    "collections",
    `fields name, games.name, games.cover.image_id, games.first_release_date, games.total_rating, ` +
      `games.aggregated_rating, games.websites.type, games.game_type; where id = ${collectionId};`
  );

  const members = (data[0]?.games ?? [])
    .filter((g) => g.cover?.image_id && (g.game_type === 0 || g.id === gameId))
    .map(toGameCard)
    .sort((a, b) => (a.released ?? "").localeCompare(b.released ?? ""));

  if (members.length === 0) return null;
  return { collectionId, members };
}

// Modos de jogo por igdbId (só os ids conhecidos do enum). Uma query por lote;
// o chamador deve fatiar em lotes ≤ 500 (limite da IGDB).
export async function fetchGameModes(ids: number[]): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return result;

  const data = await igdbQuery<{ id: number; game_modes?: number[] }[]>(
    "games",
    `fields id, game_modes; where id = (${unique.join(",")}); limit ${unique.length};`
  );
  for (const game of data) {
    const slugs = (game.game_modes ?? []).map((m) => GAME_MODE_SLUGS[m]).filter(Boolean);
    result.set(game.id, slugs);
  }
  return result;
}

// Dados de sync por igdbId. Uma query por lote (mesmo limite da IGDB do
// fetchGameModes: o chamador fatia em ≤500). Jogo que sumiu da IGDB não volta
// no Map — o chamador simplesmente não atualiza a linha.
export async function fetchGamesSyncData(ids: number[]): Promise<Map<number, GameCard>> {
  const result = new Map<number, GameCard>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return result;

  const data = await igdbQuery<IgdbGameListItem[]>(
    "games",
    `${CARD_FIELDS} where id = (${unique.join(",")}); limit ${unique.length};`
  );
  for (const game of data) result.set(game.id, toGameCard(game));
  return result;
}

export async function fetchGameById(id: number): Promise<GameDetail> {
  const data = await igdbQuery<IgdbGameDetail[]>("games", `${DETAIL_FIELDS} where id = ${id};`);
  const game = data[0];
  if (!game) throw new Error("Jogo não encontrado.");

  const companies = game.involved_companies ?? [];
  const video = (game.videos ?? []).find((v) => v.video_id);
  const official = (game.websites ?? []).find((w) => w.type === OFFICIAL_SITE_TYPE);
  const steam = (game.external_games ?? []).find((e) => e.external_game_source === STEAM_SOURCE);

  return {
    ...toGameCard(game),
    summary: game.summary || null,
    description: game.summary || null,
    website: official?.url ?? null,
    developers: companies.filter((c) => c.developer).map((c) => c.company.name),
    publishers: companies.filter((c) => c.publisher).map((c) => c.company.name),
    platforms: (game.platforms ?? []).map((p) => p.name),
    genres: (game.genres ?? []).map((g) => g.name),
    esrb: null,
    stores: storesFrom(game.websites),
    trailer: video ? { youtubeId: video.video_id } : null,
    screenshots: (game.screenshots ?? []).map((s) => igdbImage(s.image_id, "720p")),
    ratingsCount: game.total_rating_count ?? null,
    steamAppId: steam?.uid ?? null,
  };
}
