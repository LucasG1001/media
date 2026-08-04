import { httpRequest } from "../lib/httpClient.js";
import { fetchAnimeById } from "./anilistService.js";
import type { LibraryEntry } from "../types/library.js";
import type { SeriesLibraryEntry } from "../types/seriesLibrary.js";

const NOTIFY_API_URL = process.env.NOTIFY_API_URL?.replace(/\/$/, "");
const NOTIFY_API_KEY = process.env.NOTIFY_API_KEY;

interface NotifyField {
  name: string;
  value: string;
  inline?: boolean;
}

interface NotifyButton {
  text: string;
  url: string;
}

interface NotifyPayload {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  fields?: NotifyField[];
  buttons?: NotifyButton[];
}

// ---------- helpers ----------

function youtubeUrl(key: string): string {
  return `https://www.youtube.com/watch?v=${key}`;
}

function translateAnimeStatus(status: string): string {
  switch (status) {
    case "RELEASING":
      return "Em exibição";
    case "FINISHED":
      return "Finalizado";
    case "NOT_YET_RELEASED":
      return "Não lançado";
    case "CANCELLED":
      return "Cancelado";
    case "HIATUS":
      return "Em hiato";
    default:
      return status;
  }
}

async function send(type: string, payload: NotifyPayload): Promise<void> {
  if (!NOTIFY_API_URL || !NOTIFY_API_KEY) return;
  try {
    await httpRequest({
      method: "post",
      url: `${NOTIFY_API_URL}/api/notifications`,
      headers: { "x-api-key": NOTIFY_API_KEY },
      data: { type, ...payload },
    });
  } catch (error) {
    console.error("Falha ao enviar notificação:", error);
  }
}

// ---------- erros ----------

const ERROR_DEDUPE_WINDOW_MS = 60 * 1000;
const ERROR_DESCRIPTION_LIMIT = 3500;
const recentErrors = new Map<string, number>();

/**
 * Envia qualquer erro do backend para o Telegram (mesmo canal das notificações).
 * Nunca lança e registra no stdout. Erros idênticos são suprimidos por uma janela curta.
 */
export async function notifyError(
  context: string,
  error: unknown,
  meta?: Record<string, string>
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  console.error(`[${context}]`, error);

  const signature = `${context}::${message}`;
  const now = Date.now();
  const last = recentErrors.get(signature);
  if (last !== undefined && now - last < ERROR_DEDUPE_WINDOW_MS) return;
  recentErrors.set(signature, now);
  for (const [key, ts] of recentErrors) {
    if (now - ts >= ERROR_DEDUPE_WINDOW_MS) recentErrors.delete(key);
  }

  const description = (stack ? `${message}\n\n${stack}` : message).slice(0, ERROR_DESCRIPTION_LIMIT);
  const fields: NotifyField[] = [
    { name: "Origem", value: context, inline: true },
    { name: "Ambiente", value: process.env.NODE_ENV ?? "development", inline: true },
    { name: "Quando", value: new Date().toISOString() },
    ...Object.entries(meta ?? {}).map(([name, value]) => ({ name, value: String(value).slice(0, 1024) })),
  ];

  await send("erro", { title: `🚨 Erro — ${context}`, description, fields });
}

// ---------- anime ----------

function animeUrl(anilistId: number): string {
  return `https://anilist.co/anime/${anilistId}`;
}

interface AnimePresentation {
  image?: string;
  fields: NotifyField[];
  buttons: NotifyButton[];
}

/** Busca banner, trailer e links de streaming do anime; cai para os dados da entry se falhar. */
async function animePresentation(entry: LibraryEntry): Promise<AnimePresentation> {
  const fields: NotifyField[] = [];
  const buttons: NotifyButton[] = [];
  let image = entry.coverImage ?? undefined;

  try {
    const d = await fetchAnimeById(entry.anilistId);
    image = d.bannerImage ?? d.coverImage ?? image;
    fields.push(
      { name: "Status", value: translateAnimeStatus(d.status), inline: true },
      ...(d.episodes ? [{ name: "Episódios", value: String(d.episodes), inline: true }] : []),
      ...(d.averageScore ? [{ name: "Nota", value: `${d.averageScore}/100`, inline: true }] : []),
      ...(d.genres?.length ? [{ name: "Gêneros", value: d.genres.slice(0, 4).join(", ") }] : [])
    );
    if (d.trailer && d.trailer.site.toLowerCase() === "youtube") {
      buttons.push({ text: "🎥 Trailer", url: youtubeUrl(d.trailer.id) });
    }
    for (const link of (d.streamingLinks ?? []).slice(0, 3)) {
      buttons.push({ text: `▶️ ${link.site}`, url: link.url });
    }
  } catch (error) {
    console.error("Falha ao buscar detalhes do anime:", error);
    fields.push({ name: "Status", value: translateAnimeStatus(entry.animeStatus), inline: true });
    if (entry.totalEpisodes) fields.push({ name: "Episódios", value: String(entry.totalEpisodes), inline: true });
    for (const link of (entry.streamingLinks ?? []).slice(0, 3)) {
      buttons.push({ text: `▶️ ${link.site}`, url: link.url });
    }
  }

  return { image, fields, buttons };
}

export async function notifyNewEpisode(
  entry: LibraryEntry,
  episode: number,
  totalEpisodes: number | null = entry.totalEpisodes
): Promise<void> {
  const url = animeUrl(entry.anilistId);
  const { image, fields, buttons } = await animePresentation(entry);
  await send("anime-novo-episodio", {
    title: `🆕 ${entry.title}`,
    description: `Episódio ${episode} lançado`,
    image,
    url,
    fields: [
      {
        name: "Episódio",
        value: totalEpisodes ? `${episode} / ${totalEpisodes}` : String(episode),
        inline: true,
      },
      ...fields,
    ],
    buttons: [...buttons, { text: "🔗 AniList", url }],
  });
}

export async function notifyAnimeFinished(entry: LibraryEntry, totalEpisodes: number | null): Promise<void> {
  const url = animeUrl(entry.anilistId);
  const { image, fields, buttons } = await animePresentation(entry);
  await send("anime-finalizado", {
    title: `✅ ${entry.title}`,
    description: "Anime finalizado",
    image,
    url,
    fields: [
      { name: "Total de episódios", value: totalEpisodes ? String(totalEpisodes) : "?", inline: true },
      ...fields,
    ],
    buttons: [...buttons, { text: "🔗 AniList", url }],
  });
}

// ---------- séries ----------

function seriesUrl(tmdbId: number): string {
  return `https://www.themoviedb.org/tv/${tmdbId}`;
}

export async function notifySeriesNewEpisode(
  entry: SeriesLibraryEntry,
  episode: number,
  totalEpisodes: number | null = entry.episodes
): Promise<void> {
  const url = seriesUrl(entry.tmdbId);
  await send("serie-novo-episodio", {
    title: `🆕 ${entry.title}`,
    description: `Episódio ${episode} lançado`,
    image: entry.posterImage ?? undefined,
    url,
    fields: [
      {
        name: "Episódio",
        value: totalEpisodes ? `${episode} / ${totalEpisodes}` : String(episode),
        inline: true,
      },
    ],
    buttons: [{ text: "🔗 TMDB", url }],
  });
}

export async function notifySeriesFinished(entry: SeriesLibraryEntry, totalEpisodes: number | null): Promise<void> {
  const url = seriesUrl(entry.tmdbId);
  await send("serie-finalizada", {
    title: `✅ ${entry.title}`,
    description: "Série finalizada",
    image: entry.posterImage ?? undefined,
    url,
    fields: [{ name: "Total de episódios", value: totalEpisodes ? String(totalEpisodes) : "?", inline: true }],
    buttons: [{ text: "🔗 TMDB", url }],
  });
}

// ---------- coleções ----------

type CollectionMediaType = "anime" | "filme" | "jogo" | "livro";

const MEDIA_TYPE_LABEL: Record<CollectionMediaType, string> = {
  anime: "Anime",
  filme: "Filme",
  jogo: "Jogo",
  livro: "Livro",
};

// Os rótulos batem com o status "planejo" de cada mídia na UI.
const PLAN_LABEL: Record<CollectionMediaType, string> = {
  anime: "Planejo Assistir",
  filme: "Planejo Assistir",
  jogo: "Planejo Jogar",
  livro: "Quero Ler",
};

export async function notifyNewCollectionItem(args: {
  mediaType: CollectionMediaType;
  title: string;
  image?: string;
  url?: string;
  releaseLabel?: string;
}): Promise<void> {
  const planLabel = PLAN_LABEL[args.mediaType];
  const image = args.image?.startsWith("http") ? args.image : undefined;
  const fields: NotifyField[] = [{ name: "Tipo", value: MEDIA_TYPE_LABEL[args.mediaType], inline: true }];
  if (args.releaseLabel) fields.push({ name: "Estreia", value: args.releaseLabel, inline: true });
  await send("colecao-novo-item", {
    title: `📦 ${args.title}`,
    description: `Novo lançamento adicionado à sua coleção (${planLabel})`,
    image,
    url: args.url,
    fields,
    buttons: args.url ? [{ text: "🔗 Ver", url: args.url }] : undefined,
  });
}

// ---------- lançamentos (filmes / jogos / livros) ----------

function igdbAbsoluteImage(proxyPath: string | null): string | undefined {
  if (!proxyPath) return undefined;
  const url = proxyPath.replace(/^\/api\/game\/image/, "https://images.igdb.com/igdb/image/upload");
  return url.startsWith("http") ? url : undefined;
}

export async function notifyMovieReleased(movie: { tmdbId: number; title: string; posterImage: string | null }): Promise<void> {
  const url = `https://www.themoviedb.org/movie/${movie.tmdbId}`;
  await send("filme-lancado", {
    title: `🎬 ${movie.title}`,
    description: "Já está disponível!",
    image: movie.posterImage?.startsWith("http") ? movie.posterImage : undefined,
    url,
    buttons: [{ text: "🔗 TMDB", url }],
  });
}

export async function notifyGameReleased(game: { title: string; backgroundImage: string | null }): Promise<void> {
  await send("jogo-lancado", {
    title: `🎮 ${game.title}`,
    description: "Foi lançado!",
    image: igdbAbsoluteImage(game.backgroundImage),
  });
}

export async function notifyBookReleased(book: { title: string; coverImage: string | null }): Promise<void> {
  await send("livro-lancado", {
    title: `📚 ${book.title}`,
    description: "Já foi publicado!",
    image: book.coverImage?.startsWith("http") ? book.coverImage : undefined,
  });
}
