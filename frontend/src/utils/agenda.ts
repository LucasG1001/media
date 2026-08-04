import type { LibraryEntry } from "../types/library";
import type { MovieLibraryEntry } from "../types/movieLibrary";
import type { GameLibraryEntry } from "../types/gameLibrary";
import type { SeriesLibraryEntry } from "../types/seriesLibrary";
import type { BookLibraryEntry } from "../types/bookLibrary";
import { MONTH_PT } from "./month";

export type AgendaMedia = "anime" | "movie" | "series" | "game" | "book";

export interface AgendaItem {
  media: AgendaMedia;
  externalId: number | string;
  title: string;
  poster: string | null;
  when: number;
  detail: string;
  hasTime: boolean;
}

export interface AgendaGroup {
  key: string;
  label: string;
  items: AgendaItem[];
}

const WEEKDAY_ABBR_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dateOnlyToMs(date: string | null): number | null {
  if (!date) return null;
  let ms = new Date(`${date}T00:00:00`).getTime();
  if (Number.isNaN(ms)) ms = new Date(date).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function buildAgenda(
  animes: LibraryEntry[],
  movies: MovieLibraryEntry[],
  series: SeriesLibraryEntry[],
  games: GameLibraryEntry[],
  books: BookLibraryEntry[]
): AgendaItem[] {
  const floor = startOfToday();
  const items: AgendaItem[] = [];

  for (const a of animes) {
    if (a.status === "dropped" || !a.nextAiringEpisode) continue;
    const when = a.nextAiringEpisode.airingAt * 1000;
    if (when < floor) continue;
    items.push({
      media: "anime",
      externalId: a.anilistId,
      title: a.title,
      poster: a.coverImage,
      when,
      detail: `Ep. ${a.nextAiringEpisode.episode}`,
      hasTime: true,
    });
  }

  for (const s of series) {
    if (s.status === "dropped" || !s.nextAiringEpisode) continue;
    const when = s.nextAiringEpisode.airingAt * 1000;
    if (when < floor) continue;
    items.push({
      media: "series",
      externalId: s.tmdbId,
      title: s.title,
      poster: s.posterImage,
      when,
      detail: `Ep. ${s.nextAiringEpisode.episode}`,
      hasTime: false,
    });
  }

  for (const m of movies) {
    if (m.status === "dropped") continue;
    const when = dateOnlyToMs(m.releaseDate);
    if (when == null || when < floor) continue;
    items.push({
      media: "movie",
      externalId: m.tmdbId,
      title: m.title,
      poster: m.posterImage,
      when,
      detail: "Estreia",
      hasTime: false,
    });
  }

  for (const g of games) {
    if (g.status === "dropped") continue;
    const when = dateOnlyToMs(g.released);
    if (when == null || when < floor) continue;
    items.push({
      media: "game",
      externalId: g.igdbId,
      title: g.title,
      poster: g.backgroundImage,
      when,
      detail: "Lançamento",
      hasTime: false,
    });
  }

  for (const b of books) {
    if (b.status === "dropped") continue;
    const when = dateOnlyToMs(b.publishedDate);
    if (when == null || when < floor) continue;
    items.push({
      media: "book",
      externalId: b.hardcoverId,
      title: b.title,
      poster: b.coverImage,
      when,
      detail: "Lançamento",
      hasTime: false,
    });
  }

  return items.sort((a, b) => a.when - b.when);
}

export function splitAgenda(items: AgendaItem[]): { week: AgendaItem[]; later: AgendaItem[] } {
  const limit = startOfToday() + 7 * 24 * 60 * 60 * 1000;
  const week: AgendaItem[] = [];
  const later: AgendaItem[] = [];
  for (const item of items) {
    if (item.when < limit) week.push(item);
    else later.push(item);
  }
  return { week, later };
}

function dayLabel(when: number): string {
  const today = startOfToday();
  const day = 24 * 60 * 60 * 1000;
  const diff = Math.floor((when - today) / day);
  if (diff <= 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  const d = new Date(when);
  return `${WEEKDAY_ABBR_PT[d.getDay()]} ${d.getDate()}`;
}

export function groupByDay(items: AgendaItem[]): AgendaGroup[] {
  const map = new Map<string, AgendaItem[]>();
  for (const item of items) {
    const d = new Date(item.when);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return Array.from(map.entries()).map(([key, list]) => ({
    key,
    label: dayLabel(list[0].when),
    items: list,
  }));
}

export function groupByMonth(items: AgendaItem[]): AgendaGroup[] {
  const currentYear = new Date().getFullYear();
  const map = new Map<string, AgendaItem[]>();
  for (const item of items) {
    const d = new Date(item.when);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return Array.from(map.entries()).map(([key, list]) => {
    const d = new Date(list[0].when);
    const month = MONTH_PT[d.getMonth()];
    const year = d.getFullYear();
    return {
      key,
      label: year === currentYear ? month : `${month} ${year}`,
      items: list,
    };
  });
}
