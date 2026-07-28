import { chunk } from "../lib/chunk.js";
import { singleFlight } from "../lib/singleFlight.js";
import { findStaleMovies, updateMovieSyncData } from "../models/movieLibraryModel.js";
import { findStaleGames, updateGameSyncData } from "../models/gameLibraryModel.js";
import { fetchMovieSyncData } from "./tmdbService.js";
import { fetchGamesSyncData } from "./igdbService.js";
import { notifyError } from "./notifyService.js";

// Filmes e jogos não têm episódio para acompanhar: o que envelhece é a data de
// lançamento (adiamento), o título e a capa. Por isso o TTL curto vale só para
// quem ainda não lançou.
const UPCOMING_TTL_HOURS = 12;
const RELEASED_TTL_HOURS = 24 * 7;

// O TMDB não tem endpoint em lote (1 requisição por filme), então o primeiro
// sync de uma biblioteca grande é fatiado entre execuções do job.
const MOVIE_RUN_LIMIT = 100;
const MOVIE_CONCURRENCY = 10;
const IGDB_BATCH_SIZE = 200;

export const refreshStaleMovies = singleFlight(doRefreshMovies);

async function doRefreshMovies(): Promise<void> {
  const stale = await findStaleMovies(UPCOMING_TTL_HOURS, RELEASED_TTL_HOURS, MOVIE_RUN_LIMIT);
  if (stale.length === 0) return;

  for (const batch of chunk(stale, MOVIE_CONCURRENCY)) {
    await Promise.all(
      batch.map(async (entry) => {
        try {
          const fresh = await fetchMovieSyncData(entry.tmdbId);
          await updateMovieSyncData(entry.tmdbId, fresh);
        } catch (error) {
          await notifyError("releaseLibrarySyncService.refreshStaleMovies", error, {
            tmdbId: String(entry.tmdbId),
          });
        }
      })
    );
  }
}

export const refreshStaleGames = singleFlight(doRefreshGames);

async function doRefreshGames(): Promise<void> {
  const stale = await findStaleGames(UPCOMING_TTL_HOURS, RELEASED_TTL_HOURS);
  if (stale.length === 0) return;

  for (const batch of chunk(stale, IGDB_BATCH_SIZE)) {
    try {
      const fresh = await fetchGamesSyncData(batch.map((entry) => entry.igdbId));
      for (const entry of batch) {
        // Jogo ausente do retorno (removido da IGDB): mantém a linha como está.
        const game = fresh.get(entry.igdbId);
        if (!game) continue;
        await updateGameSyncData(entry.igdbId, {
          title: game.title,
          backgroundImage: game.backgroundImage,
          released: game.released,
          metacritic: game.metacritic,
          gameStatus: game.gameStatus,
        });
      }
    } catch (error) {
      await notifyError("releaseLibrarySyncService.refreshStaleGames", error);
    }
  }
}
