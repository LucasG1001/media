import { z } from "zod";

const score = z.number().min(0).max(10).optional();
const nullableString = z.string().nullish();
const nullableNumber = z.number().nullish();

export const movieCreateSchema = z.object({
  tmdbId: z.number(),
  title: z.string().min(1),
  posterImage: nullableString,
  status: z.enum(["plan_to_watch", "watched", "dropped"]).optional(),
  score,
  releaseDate: nullableString,
  runtime: nullableNumber,
  movieStatus: z.string().optional(),
});
export const movieUpdateSchema = movieCreateSchema.partial().extend({ isRewatching: z.boolean().optional() });

export const seriesCreateSchema = z.object({
  tmdbId: z.number(),
  title: z.string().min(1),
  posterImage: nullableString,
  status: z.enum(["plan_to_watch", "watched", "dropped"]).optional(),
  score,
  firstAirDate: nullableString,
  seasons: nullableNumber,
  episodes: nullableNumber,
  seriesStatus: z.string().optional(),
});
export const seriesUpdateSchema = seriesCreateSchema.partial().extend({ isRewatching: z.boolean().optional() });

export const gameCreateSchema = z.object({
  igdbId: z.number(),
  title: z.string().min(1),
  backgroundImage: nullableString,
  status: z.enum(["plan_to_play", "beaten", "dropped"]).optional(),
  score,
  released: nullableString,
  metacritic: nullableNumber,
  gameStatus: z.string().optional(),
  gameModes: z.array(z.string()).optional(),
});
export const gameUpdateSchema = gameCreateSchema.partial().extend({ isRewatching: z.boolean().optional() });

export const bookCreateSchema = z.object({
  googleBooksId: z.string().min(1),
  title: z.string().min(1),
  coverImage: nullableString,
  authors: nullableString,
  status: z.enum(["plan_to_read", "read", "dropped"]).optional(),
  score,
  publishedDate: nullableString,
  pageCount: nullableNumber,
});
export const bookUpdateSchema = bookCreateSchema.partial();

export const animeCreateSchema = z.object({
  anilistId: z.number(),
  title: z.string().min(1),
  coverImage: nullableString,
  status: z.enum(["plan_to_watch", "watched", "dropped"]).optional(),
  score,
  totalEpisodes: nullableNumber,
  animeStatus: z.string().optional(),
  format: nullableString,
  seasonYear: nullableNumber,
  nextAiringEpisode: z.unknown().nullish(),
  streamingLinks: z.array(z.unknown()).optional(),
});
export const animeUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  coverImage: nullableString,
  status: z.enum(["plan_to_watch", "watched", "dropped"]).optional(),
  score,
  totalEpisodes: nullableNumber,
  animeStatus: z.string().optional(),
  isRewatching: z.boolean().optional(),
});

const youtubeStatus = z.enum(["liked", "removed"]);

export const youtubeCreateSchema = z.object({
  videoId: z.string().min(1),
  title: z.string().min(1),
  channelId: nullableString,
  channelTitle: nullableString,
  channelThumbnail: nullableString,
  thumbnail: nullableString,
  durationSeconds: nullableNumber,
  viewCount: nullableNumber,
  publishedAt: nullableString,
  description: nullableString,
  status: youtubeStatus.optional(),
  score,
});
export const youtubeUpdateSchema = youtubeCreateSchema.partial().extend({ isRewatching: z.boolean().optional() });

export const youtubeFromUrlSchema = z.object({ url: z.string().min(1) });
export const youtubeFormGroupSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  name: z.string().min(1),
});
export const youtubeAddToGroupSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  collectionId: z.number(),
});
export const youtubeRemoveFromGroupSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});
export const youtubeRenameSchema = z.object({ name: z.string().min(1) });
