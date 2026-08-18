import type { LibraryEntry } from "../types/library";
import type { MovieLibraryEntry } from "../types/movieLibrary";
import type { GameLibraryEntry } from "../types/gameLibrary";
import type { SeriesLibraryEntry } from "../types/seriesLibrary";
import type { BookLibraryEntry } from "../types/bookLibrary";
import type { AgendaMedia } from "./agenda";
import { dateOnlyToMs, startOfToday } from "./agenda";

// Espelho da agenda: em vez do que vai lançar, o que já lançou e ainda não foi
// consumido. Só entra item em "planejo" — o carrossel é uma fila de "já dá para
// assistir/jogar/ler", então marcar como concluído tira o item de lá.
export interface ReleaseItem {
  media: AgendaMedia;
  externalId: number;
  title: string;
  poster: string | null;
  when: number;
  detail: string;
  // Só em séries: a temporada que encerrou, usada para abrir o SeasonDrawer.
  seasonNumber?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 90;
// Fora da janela o carrossel completa até este mínimo, para não ficar vazio (ou
// com um item solitário) em período parado.
const MIN_ITEMS = 10;

// A temporada do último episódio exibido acabou quando não há próximo episódio
// (série encerrada ou em hiato entre temporadas) ou quando o próximo já é de
// uma temporada posterior. Linha gravada antes da coluna last_aired_episode não
// tem `season` no próximo episódio: aí só o primeiro caso conta — o carrossel
// mostra menos temporadas, nunca a temporada errada.
function endedSeasonOf(entry: SeriesLibraryEntry): number | null {
  const last = entry.lastAiredEpisode;
  if (!last) return null;
  const next = entry.nextAiringEpisode;
  if (!next) return last.season;
  if (next.season !== undefined && next.season > last.season) return last.season;
  return null;
}

export function buildRecentReleases(
  animes: LibraryEntry[],
  movies: MovieLibraryEntry[],
  series: SeriesLibraryEntry[],
  games: GameLibraryEntry[],
  books: BookLibraryEntry[]
): ReleaseItem[] {
  const ceiling = startOfToday() + DAY_MS - 1;
  const items: ReleaseItem[] = [];

  const push = (item: ReleaseItem | null) => {
    if (item && item.when <= ceiling) items.push(item);
  };

  for (const a of animes) {
    if (a.status !== "plan_to_watch" || a.animeStatus !== "FINISHED") continue;
    const when = dateOnlyToMs(a.endDate);
    if (when == null) continue;
    push({
      media: "anime",
      externalId: a.anilistId,
      title: a.title,
      poster: a.coverImage,
      when,
      detail: "Terminou de lançar",
    });
  }

  for (const s of series) {
    const season = endedSeasonOf(s);
    if (season == null) {
      // Série sem last_aired_episode (nunca sincronizada ou nunca exibida) cai
      // no estado da série inteira, como o resto do app faz quando não há
      // season_list.
      if (s.status !== "plan_to_watch") continue;
      if (s.airStatus !== "Ended" && s.airStatus !== "Canceled") continue;
      const when = dateOnlyToMs(s.firstAirDate);
      if (when == null) continue;
      push({
        media: "series",
        externalId: s.tmdbId,
        title: s.title,
        poster: s.posterImage,
        when,
        detail: "Terminou de lançar",
      });
      continue;
    }
    // O status que vale é o da temporada, não o da série — coerente com o
    // tratamento member-level do resto do app.
    const state = s.seasonStates?.[String(season)];
    if ((state?.status ?? "plan_to_watch") !== "plan_to_watch") continue;
    const when = dateOnlyToMs(s.lastAiredEpisode!.airDate);
    if (when == null) continue;
    const poster = s.seasonList?.find((meta) => meta.number === season)?.poster ?? s.posterImage;
    push({
      media: "series",
      externalId: s.tmdbId,
      title: s.title,
      poster,
      when,
      detail: season === 0 ? "Especiais completos" : `Temporada ${season} completa`,
      seasonNumber: season,
    });
  }

  for (const m of movies) {
    if (m.status !== "plan_to_watch") continue;
    const when = dateOnlyToMs(m.releaseDate);
    if (when == null) continue;
    push({
      media: "movie",
      externalId: m.tmdbId,
      title: m.title,
      poster: m.posterImage,
      when,
      detail: "Lançou",
    });
  }

  for (const g of games) {
    if (g.status !== "plan_to_play") continue;
    const when = dateOnlyToMs(g.released);
    if (when == null) continue;
    push({
      media: "game",
      externalId: g.igdbId,
      title: g.title,
      poster: g.backgroundImage,
      when,
      detail: "Lançou",
    });
  }

  for (const b of books) {
    if (b.status !== "plan_to_read") continue;
    const when = dateOnlyToMs(b.publishedDate);
    if (when == null) continue;
    push({
      media: "book",
      externalId: b.hardcoverId,
      title: b.title,
      poster: b.coverImage,
      when,
      detail: "Lançou",
    });
  }

  return applyWindow(items);
}

// Recorte comum aos dois carrosséis: o que caiu na janela recente, completado
// com os mais recentes de fora dela quando sobra pouca coisa.
function applyWindow(items: ReleaseItem[]): ReleaseItem[] {
  const sorted = items.sort((a, b) => b.when - a.when);
  const floor = startOfToday() - WINDOW_DAYS * DAY_MS;
  const inWindow = sorted.filter((item) => item.when >= floor);
  // Já ordenado por data desc, então completar é só pegar um prefixo maior.
  return inWindow.length >= MIN_ITEMS ? inWindow : sorted.slice(0, MIN_ITEMS);
}

// O outro lado da moeda: episódio solto de coisa que ainda está no ar. É
// complementar ao buildRecentReleases por construção — lá entra o que fechou
// (anime FINISHED, temporada encerrada), aqui o que segue saindo. Filme, jogo e
// livro não têm episódio e por isso não aparecem.
//
// Aqui o recorte por status é só "não abandonado", e não "falta consumir" como
// no outro: episódio novo de série em que você está em dia é justamente o que se
// quer ver. É a mesma regra da notificação de novo episódio (detectAndNotify).
export function buildRecentEpisodes(
  animes: LibraryEntry[],
  series: SeriesLibraryEntry[]
): ReleaseItem[] {
  const ceiling = startOfToday() + DAY_MS - 1;
  const items: ReleaseItem[] = [];

  for (const a of animes) {
    if (a.status === "dropped" || a.animeStatus !== "RELEASING") continue;
    if (!a.lastAiredEpisode) continue;
    const when = a.lastAiredEpisode.airingAt * 1000;
    if (when > ceiling) continue;
    items.push({
      media: "anime",
      externalId: a.anilistId,
      title: a.title,
      poster: a.coverImage,
      when,
      detail: `Ep. ${a.lastAiredEpisode.episode}`,
    });
  }

  for (const s of series) {
    if (s.status === "dropped") continue;
    const last = s.lastAiredEpisode;
    // Temporada encerrada é assunto do outro carrossel.
    if (!last || endedSeasonOf(s) !== null) continue;
    const state = s.seasonStates?.[String(last.season)];
    if (state?.status === "dropped") continue;
    const when = dateOnlyToMs(last.airDate);
    if (when == null || when > ceiling) continue;
    const poster = s.seasonList?.find((meta) => meta.number === last.season)?.poster ?? s.posterImage;
    items.push({
      media: "series",
      externalId: s.tmdbId,
      title: s.title,
      poster,
      when,
      detail: last.season === 0 ? `Especiais · Ep. ${last.episode}` : `T${last.season} · Ep. ${last.episode}`,
      seasonNumber: last.season,
    });
  }

  return applyWindow(items);
}
