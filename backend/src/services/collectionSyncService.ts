import * as libraryModel from "../models/libraryModel.js";
import { singleFlight } from "../lib/singleFlight.js";
import { movieLibraryModel, bulkUpsertMovies } from "../models/movieLibraryModel.js";
import { gameLibraryModel, bulkUpsertGames } from "../models/gameLibraryModel.js";
import { bookLibraryModel, bulkUpsertBooks } from "../models/bookLibraryModel.js";
import { discoverFranchise } from "./anilistService.js";
import { discoverCollection } from "./tmdbService.js";
import { discoverGameCollection } from "./igdbService.js";
import { discoverBookSeries } from "./hardcoverService.js";
import { notifyNewCollectionItem, notifyError } from "./notifyService.js";
import type { AnimeCard } from "../types/anime.js";
import type { MovieCard } from "../types/movie.js";
import type { GameCard } from "../types/game.js";
import type { BookCard } from "../types/book.js";
import type { LibraryEntry, CreateLibraryEntry } from "../types/library.js";
import type { MovieLibraryEntry, CreateMovieLibraryEntry } from "../types/movieLibrary.js";
import type { GameLibraryEntry, CreateGameLibraryEntry } from "../types/gameLibrary.js";
import type { BookLibraryEntry, CreateBookLibraryEntry } from "../types/bookLibrary.js";

function igdbAbsoluteImage(proxyPath: string | null): string | undefined {
  if (!proxyPath) return undefined;
  return proxyPath.replace(/^\/api\/game\/image/, "https://images.igdb.com/igdb/image/upload");
}

function formatReleaseDate(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getUTCFullYear()}`;
}

function animeReleaseLabel(member: AnimeCard): string | undefined {
  if (member.status !== "NOT_YET_RELEASED") return undefined;
  if (member.nextAiringEpisode) return formatReleaseDate(new Date(member.nextAiringEpisode.airingAt * 1000));
  return member.seasonYear ? String(member.seasonYear) : undefined;
}

function isoReleaseLabel(iso: string | null, upcoming: boolean): string | undefined {
  if (!upcoming || !iso) return undefined;
  return formatReleaseDate(new Date(`${iso}T00:00:00Z`));
}

interface CollectionSyncAdapter<E, C, Cr> {
  label: string;
  findAll(): Promise<E[]>;
  externalId(entry: E): number;
  collectionKey(entry: E): number | null;
  isCompleted(entry: E): boolean;
  discover(seedId: number): Promise<{ collectionId: number; members: C[] } | null>;
  memberId(member: C): number;
  toCreateEntry(member: C): Cr;
  bulkUpsert(entries: Cr[], collectionId: number): Promise<unknown>;
  notify(member: C, collectionId: number): Promise<void>;
}

async function syncOne<E, C, Cr>(adapter: CollectionSyncAdapter<E, C, Cr>): Promise<number> {
  const entries = await adapter.findAll();
  const existingIds = new Set(entries.map((entry) => adapter.externalId(entry)));

  const completedKeys = new Set<number>();
  for (const entry of entries) {
    const key = adapter.collectionKey(entry);
    if (key != null && adapter.isCompleted(entry)) completedKeys.add(key);
  }

  const seeds = new Set<number>();
  const seededKeys = new Set<number>();
  for (const entry of entries) {
    const key = adapter.collectionKey(entry);
    if (key != null) {
      if (completedKeys.has(key) && !seededKeys.has(key)) {
        seededKeys.add(key);
        seeds.add(adapter.externalId(entry));
      }
    } else if (adapter.isCompleted(entry)) {
      seeds.add(adapter.externalId(entry));
    }
  }

  let added = 0;
  for (const seed of seeds) {
    try {
      const result = await adapter.discover(seed);
      if (!result) continue;

      const novos = result.members.filter((member) => !existingIds.has(adapter.memberId(member)));
      if (novos.length === 0) continue;

      await adapter.bulkUpsert(
        result.members.map((member) => adapter.toCreateEntry(member)),
        result.collectionId
      );

      for (const member of novos) {
        existingIds.add(adapter.memberId(member));
        await adapter.notify(member, result.collectionId);
        added++;
      }
    } catch (error) {
      await notifyError("collectionSyncService.syncOne", error, { mediaType: adapter.label, seed: String(seed) });
    }
  }

  if (added > 0) console.log(`Sync de coleções (${adapter.label}): ${added} novo(s) item(ns) adicionado(s).`);
  return added;
}

const animeAdapter: CollectionSyncAdapter<LibraryEntry, AnimeCard, CreateLibraryEntry> = {
  label: "anime",
  findAll: () => libraryModel.findAll(),
  externalId: (entry) => entry.anilistId,
  collectionKey: (entry) => entry.franchiseId,
  isCompleted: (entry) => entry.status === "watched",
  discover: async (seedId) => {
    const members = await discoverFranchise(seedId);
    if (members.length < 2) return null;
    return { collectionId: Math.min(...members.map((m) => m.id)), members };
  },
  memberId: (member) => member.id,
  toCreateEntry: (member) => ({
    anilistId: member.id,
    title: member.title,
    coverImage: member.coverImage,
    status: "plan_to_watch",
    score: 0,
    totalEpisodes: member.episodes,
    animeStatus: member.status,
    format: member.format,
    seasonYear: member.seasonYear,
    nextAiringEpisode: member.nextAiringEpisode,
    streamingLinks: member.streamingLinks,
  }),
  bulkUpsert: (entries, collectionId) => libraryModel.bulkUpsert(entries, collectionId),
  notify: (member) =>
    notifyNewCollectionItem({
      mediaType: "anime",
      title: member.title,
      image: member.coverImage ?? undefined,
      url: `https://anilist.co/anime/${member.id}`,
      releaseLabel: animeReleaseLabel(member),
    }),
};

const movieAdapter: CollectionSyncAdapter<MovieLibraryEntry, MovieCard, CreateMovieLibraryEntry> = {
  label: "filme",
  findAll: () => movieLibraryModel.findAll(),
  externalId: (entry) => entry.tmdbId,
  collectionKey: (entry) => entry.collectionId,
  isCompleted: (entry) => entry.status === "watched",
  discover: (seedId) => discoverCollection(seedId),
  memberId: (member) => member.id,
  toCreateEntry: (member) => ({
    tmdbId: member.id,
    title: member.title,
    posterImage: member.posterImage,
    status: "plan_to_watch",
    score: 0,
    releaseDate: member.releaseDate,
    movieStatus: member.movieStatus,
  }),
  bulkUpsert: (entries, collectionId) => bulkUpsertMovies(entries, collectionId),
  notify: (member) =>
    notifyNewCollectionItem({
      mediaType: "filme",
      title: member.title,
      image: member.posterImage ?? undefined,
      url: `https://www.themoviedb.org/movie/${member.id}`,
      releaseLabel: isoReleaseLabel(member.releaseDate, member.movieStatus === "UPCOMING"),
    }),
};

const gameAdapter: CollectionSyncAdapter<GameLibraryEntry, GameCard, CreateGameLibraryEntry> = {
  label: "jogo",
  findAll: () => gameLibraryModel.findAll(),
  externalId: (entry) => entry.igdbId,
  collectionKey: (entry) => entry.collectionId,
  isCompleted: (entry) => entry.status === "beaten",
  discover: (seedId) => discoverGameCollection(seedId),
  memberId: (member) => member.id,
  toCreateEntry: (member) => ({
    igdbId: member.id,
    title: member.title,
    backgroundImage: member.backgroundImage,
    status: "plan_to_play",
    score: 0,
    released: member.released,
    metacritic: member.metacritic,
    gameStatus: member.gameStatus,
  }),
  bulkUpsert: (entries, collectionId) => bulkUpsertGames(entries, collectionId),
  notify: (member) =>
    notifyNewCollectionItem({
      mediaType: "jogo",
      title: member.title,
      image: igdbAbsoluteImage(member.backgroundImage),
      releaseLabel: isoReleaseLabel(member.released, member.gameStatus === "UPCOMING"),
    }),
};

// A coleção do livro é a série em destaque da Hardcover. `discoverBookSeries` já aplica
// a deduplicação e a trava de sobreposição de autor, então aqui não há nada de especial:
// os ids da Hardcover são inteiros e encaixam direto no adapter genérico.
const bookAdapter: CollectionSyncAdapter<BookLibraryEntry, BookCard, CreateBookLibraryEntry> = {
  label: "livro",
  findAll: () => bookLibraryModel.findAll(),
  externalId: (entry) => entry.hardcoverId,
  collectionKey: (entry) => entry.collectionId,
  isCompleted: (entry) => entry.status === "read",
  discover: (seedId) => discoverBookSeries(seedId),
  memberId: (member) => member.id,
  toCreateEntry: (member) => ({
    hardcoverId: member.id,
    title: member.title,
    coverImage: member.coverImage,
    authors: member.authors.length > 0 ? member.authors.join(", ") : null,
    status: "plan_to_read",
    score: 0,
    publishedDate: member.publishedDate,
    pageCount: member.pageCount,
    bookStatus: member.bookStatus,
    seriesName: member.seriesName,
    seriesPosition: member.seriesPosition,
  }),
  bulkUpsert: (entries, collectionId) => bulkUpsertBooks(entries, collectionId),
  notify: (member) =>
    notifyNewCollectionItem({
      mediaType: "livro",
      title: member.title,
      image: member.coverImage ?? undefined,
      url: member.slug ? `https://hardcover.app/books/${member.slug}` : undefined,
      releaseLabel: isoReleaseLabel(member.publishedDate, member.bookStatus === "UPCOMING"),
    }),
};

export const refreshCollections = singleFlight(doRefresh);

async function doRefresh(): Promise<void> {
  await syncOne(animeAdapter);
  await syncOne(movieAdapter);
  await syncOne(gameAdapter);
  await syncOne(bookAdapter);
}
