import { z } from "zod";

const score = z.number().min(0).max(10).optional();
const nullableString = z.string().nullish();
const nullableNumber = z.number().nullish();
const notes = z.string().max(20000).nullish();
const genres = z.array(z.string().min(1).max(80)).max(50).optional();

export const movieCreateSchema = z.object({
  tmdbId: z.number(),
  title: z.string().min(1),
  posterImage: nullableString,
  status: z.enum(["plan_to_watch", "watched", "rewatching", "dropped"]).optional(),
  score,
  releaseDate: nullableString,
  runtime: nullableNumber,
  movieStatus: z.string().optional(),
  genres,
});
export const movieUpdateSchema = movieCreateSchema.partial().extend({ notes });

export const seriesCreateSchema = z.object({
  tmdbId: z.number(),
  title: z.string().min(1),
  posterImage: nullableString,
  status: z.enum(["plan_to_watch", "watched", "rewatching", "dropped"]).optional(),
  score,
  firstAirDate: nullableString,
  seasons: nullableNumber,
  episodes: nullableNumber,
  seriesStatus: z.string().optional(),
  genres,
});
export const seriesUpdateSchema = seriesCreateSchema.partial();

export const gameCreateSchema = z.object({
  igdbId: z.number(),
  title: z.string().min(1),
  backgroundImage: nullableString,
  status: z.enum(["plan_to_play", "beaten", "replaying", "dropped"]).optional(),
  score,
  released: nullableString,
  metacritic: nullableNumber,
  gameStatus: z.string().optional(),
  gameModes: z.array(z.string()).optional(),
  genres,
});
export const gameUpdateSchema = gameCreateSchema.partial().extend({ notes });

// collectionId/seriesName/seriesPosition ficam de fora de propósito: só a descoberta
// de série os escreve, o cliente nunca os manda (igual ao collectionId dos filmes).
export const bookCreateSchema = z.object({
  hardcoverId: z.number().int().positive(),
  title: z.string().min(1),
  coverImage: nullableString,
  authors: nullableString,
  status: z.enum(["plan_to_read", "read", "rereading", "dropped"]).optional(),
  score,
  publishedDate: nullableString,
  pageCount: nullableNumber,
  bookStatus: z.string().optional(),
  genres,
});
export const bookUpdateSchema = bookCreateSchema.partial().extend({ notes });

export const animeCreateSchema = z.object({
  anilistId: z.number(),
  title: z.string().min(1),
  coverImage: nullableString,
  status: z.enum(["plan_to_watch", "watched", "rewatching", "dropped"]).optional(),
  score,
  totalEpisodes: nullableNumber,
  animeStatus: z.string().optional(),
  format: nullableString,
  seasonYear: nullableNumber,
  nextAiringEpisode: z.unknown().nullish(),
  streamingLinks: z.array(z.unknown()).optional(),
  genres,
});
export const animeUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  coverImage: nullableString,
  status: z.enum(["plan_to_watch", "watched", "rewatching", "dropped"]).optional(),
  score,
  totalEpisodes: nullableNumber,
  animeStatus: z.string().optional(),
  genres,
  notes,
});

const youtubeStatus = z.enum(["liked", "removed"]);
const youtubeKind = z.enum(["music", "video"]);

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
  kind: youtubeKind.optional(),
  status: youtubeStatus.optional(),
  score,
});
export const youtubeUpdateSchema = youtubeCreateSchema.partial().extend({ notes });

// `kind` é a aba em que o link foi colado; ausente, entra como vídeo.
export const youtubeFromUrlSchema = z.object({ url: z.string().min(1), kind: youtubeKind.optional() });

// `guid` e não `uuid`: o Postgres aceita qualquer 8-4-4-4-12 hexadecimal, e o
// que importa aqui é barrar o que estouraria o cast (id temporário do cliente).
const entryIds = z.array(z.guid()).max(5000);
const playlistName = z.string().trim().min(1).max(120);

export const youtubePlaylistCreateSchema = z.object({
  name: playlistName,
  kind: youtubeKind,
  entryIds: entryIds.optional(),
});
export const youtubePlaylistRenameSchema = z.object({ name: playlistName });
export const youtubePlaylistItemsSchema = z.object({ entryIds: entryIds.min(1) });
export const youtubePlaylistIdSchema = z.guid();
