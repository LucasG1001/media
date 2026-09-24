import { BOOK_GENRES } from "./bookGenres";

export interface GenreOption {
  value: string;
  label: string;
  count: number;
}

// E entre os gêneros marcados: o item precisa ter todos. Item sem gênero conhecido
// (NULL = ainda não sincronizado) só passa quando nada está marcado.
export function hasAllGenres(genres: string[] | null | undefined, selected: string[]): boolean {
  if (selected.length === 0) return true;
  if (!genres) return false;
  return selected.every((g) => genres.includes(g));
}

export function sameGenres(a: string[] | null | undefined, b: string[]): boolean {
  return a != null && a.length === b.length && a.every((g, i) => g === b[i]);
}

// Opções facetadas: contadas só sobre os itens que já passam nos gêneros marcados,
// então cada marcação encolhe a lista para o que ainda coexiste com ela. Os marcados
// ficam sempre, para poderem ser desmarcados. `items` chega já filtrado pelos
// outros grupos (status, lançamento…), senão a contagem mentiria.
export function buildGenreOptions<T>(
  items: T[],
  selected: string[],
  getGenres: (item: T) => string[] | null | undefined,
  labels: Record<string, string> = {}
): GenreOption[] {
  const counts = new Map<string, number>(selected.map((g) => [g, 0]));
  for (const item of items) {
    const genres = getGenres(item);
    if (!hasAllGenres(genres, selected) || !genres) continue;
    for (const g of new Set(genres)) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return [...counts]
    .map(([value, count]) => ({ value, label: labels[value] ?? value, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
}

export function toggleGenre(selected: string[], genre: string): string[] {
  return selected.includes(genre) ? selected.filter((g) => g !== genre) : [...selected, genre];
}

// AniList e IGDB devolvem gênero em inglês, de um conjunto fechado; o TMDB já vem
// em pt-BR. Gênero fora do mapa aparece com o nome cru.
export const ANIME_GENRE_LABELS: Record<string, string> = {
  Action: "Ação",
  Adventure: "Aventura",
  Comedy: "Comédia",
  Drama: "Drama",
  Ecchi: "Ecchi",
  Fantasy: "Fantasia",
  Hentai: "Hentai",
  Horror: "Terror",
  "Mahou Shoujo": "Mahou Shoujo",
  Mecha: "Mecha",
  Music: "Música",
  Mystery: "Mistério",
  Psychological: "Psicológico",
  Romance: "Romance",
  "Sci-Fi": "Ficção Científica",
  "Slice of Life": "Slice of Life",
  Sports: "Esportes",
  Supernatural: "Sobrenatural",
  Thriller: "Suspense",
};

export const GAME_GENRE_LABELS: Record<string, string> = {
  Adventure: "Aventura",
  Arcade: "Arcade",
  "Card & Board Game": "Cartas e Tabuleiro",
  Fighting: "Luta",
  "Hack and slash/Beat 'em up": "Hack and Slash",
  Indie: "Indie",
  MOBA: "MOBA",
  Music: "Música",
  Pinball: "Pinball",
  Platform: "Plataforma",
  "Point-and-click": "Point-and-click",
  Puzzle: "Quebra-cabeça",
  "Quiz/Trivia": "Quiz",
  Racing: "Corrida",
  "Real Time Strategy (RTS)": "Estratégia em Tempo Real",
  "Role-playing (RPG)": "RPG",
  Shooter: "Tiro",
  Simulator: "Simulação",
  Sport: "Esporte",
  Strategy: "Estratégia",
  Tactical: "Tático",
  "Turn-based strategy (TBS)": "Estratégia por Turnos",
  "Visual Novel": "Visual Novel",
};

export const BOOK_GENRE_LABELS: Record<string, string> = Object.fromEntries(
  BOOK_GENRES.map((g) => [g.value, g.label])
);
