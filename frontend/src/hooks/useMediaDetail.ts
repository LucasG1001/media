import type { AnimeDetail } from "../types/anime";
import type { GameDetail } from "../types/game";
import type { MovieDetail } from "../types/movie";
import type { SeasonDetail, SeriesDetail } from "../types/series";
import { fetchAnimeById } from "../services/animeService";
import { fetchGameById } from "../services/gameService";
import { fetchMovieById } from "../services/movieService";
import { fetchSeasonById, fetchSeriesById } from "../services/seriesService";
import { useKeyedDetail } from "./useKeyedDetail";

// O detalhe de cada mídia, compartilhado entre o drawer e a visão de detalhe.

export function useAnimeDetail(animeId: number, onLoad?: (anime: AnimeDetail) => void) {
  const { data, loading, error } = useKeyedDetail(animeId, () => fetchAnimeById(animeId), onLoad);
  return { anime: data, loading, error };
}

export function useMovieDetail(movieId: number, onLoad?: (movie: MovieDetail) => void) {
  const { data, loading, error } = useKeyedDetail(movieId, () => fetchMovieById(movieId), onLoad);
  return { movie: data, loading, error };
}

export function useGameDetail(gameId: number, onLoad?: (game: GameDetail) => void) {
  const { data, loading, error } = useKeyedDetail(gameId, () => fetchGameById(gameId), onLoad);
  return { game: data, loading, error };
}

// Série + uma temporada dela. `seasonNumber` nulo é a série sem `season_list`,
// que não tem temporada para buscar. A chave junta os dois: navegar entre
// temporadas troca a chave sem remontar quem usa.
export function useSeasonDetail(
  seriesId: number,
  seasonNumber: number | null,
  onSeriesLoad?: (series: SeriesDetail) => void
) {
  const key = `${seriesId}-${seasonNumber ?? "series"}`;
  const { data, loading, error } = useKeyedDetail(
    key,
    async (): Promise<{ series: SeriesDetail; season: SeasonDetail | null }> => {
      const [series, season] = await Promise.all([
        fetchSeriesById(seriesId),
        seasonNumber != null ? fetchSeasonById(seriesId, seasonNumber) : null,
      ]);
      return { series, season };
    },
    (loaded) => onSeriesLoad?.(loaded.series)
  );
  return { key, series: data?.series ?? null, season: data?.season ?? null, loading, error };
}
