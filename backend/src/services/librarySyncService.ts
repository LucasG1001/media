import * as libraryModel from "../models/libraryModel.js";
import { singleFlight } from "../lib/singleFlight.js";
import { fetchAnimesByIds } from "./anilistService.js";
import { notifyNewEpisode, notifyAnimeFinished, notifyError } from "./notifyService.js";
import type { AniListNextAiringEpisode } from "../types/anime.js";
import type { LibraryEntry } from "../types/library.js";
import type { AnimeCard } from "../types/anime.js";

const NON_FINISHED_TTL_HOURS = 1;
const FINISHED_TTL_HOURS = 24 * 7;

export function lastAiredEpisode(
  animeStatus: string,
  nextAiringEpisode: AniListNextAiringEpisode | null,
  totalEpisodes: number | null
): number {
  if (nextAiringEpisode) return nextAiringEpisode.episode - 1;
  if (animeStatus === "FINISHED") return totalEpisodes ?? 0;
  return 0;
}

export function detectAndNotify(old: LibraryEntry, anime: AnimeCard): void {
  const oldLast = lastAiredEpisode(old.animeStatus, old.nextAiringEpisode, old.totalEpisodes);
  const newLast = lastAiredEpisode(anime.status, anime.nextAiringEpisode, anime.episodes);
  const finishing = old.animeStatus !== "FINISHED" && anime.status === "FINISHED";

  if (finishing) {
    void notifyAnimeFinished(old, anime.episodes);
    return;
  }

  if (newLast > oldLast) {
    void notifyNewEpisode(old, newLast, anime.episodes);
  }
}

export const refreshStaleEntries = singleFlight(doRefresh);

async function doRefresh(): Promise<void> {
  const stale = await libraryModel.findStale(NON_FINISHED_TTL_HOURS, FINISHED_TTL_HOURS);
  if (stale.length === 0) return;

  try {
    const byId = new Map(stale.map((entry) => [entry.anilistId, entry]));
    const animes = await fetchAnimesByIds(stale.map((entry) => entry.anilistId));
    await Promise.all(
      animes.map((anime) => {
        const old = byId.get(anime.id);
        if (old && old.syncedAt && old.status !== "dropped") {
          detectAndNotify(old, anime);
        }
        return libraryModel.updateSyncData(anime.id, {
          title: anime.title,
          coverImage: anime.coverImage,
          format: anime.format,
          totalEpisodes: anime.episodes,
          animeStatus: anime.status,
          seasonYear: anime.seasonYear,
          nextAiringEpisode: anime.nextAiringEpisode,
          streamingLinks: anime.streamingLinks,
        });
      })
    );
  } catch (error) {
    await notifyError("librarySyncService.refreshStaleEntries", error);
  }
}
