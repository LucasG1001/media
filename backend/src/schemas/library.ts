import { z } from "zod";

const score = z.number().min(0).max(10).optional();
const nullableString = z.string().nullish();
const nullableNumber = z.number().nullish();
const notes = z.string().max(20000).nullish();
// Tag do vídeo: string não vazia. Só o YouTube usa.
const tag = z.string().min(1).max(60);

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
export const movieUpdateSchema = movieCreateSchema.partial().extend({ notes });

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
export const seriesUpdateSchema = seriesCreateSchema.partial();

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
export const gameUpdateSchema = gameCreateSchema.partial().extend({ notes });

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
export const bookUpdateSchema = bookCreateSchema.partial().extend({ notes });

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
  notes,
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
  tags: z.array(tag).max(50).optional(),
});
export const youtubeUpdateSchema = youtubeCreateSchema.partial().extend({ notes });

export const youtubeFromUrlSchema = z.object({ url: z.string().min(1) });
export const youtubeBulkTagSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  tag,
});
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
