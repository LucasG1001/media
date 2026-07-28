import { findStaleSeries, updateSeriesSyncData, findDueSeriesEpisodes, markSeriesEpisodeNotified } from "../models/seriesLibraryModel.js";
import { singleFlight } from "../lib/singleFlight.js";
import { fetchSeriesSyncData, type SeriesSyncResult } from "./tmdbSeriesService.js";
import { notifySeriesNewEpisode, notifySeriesFinished, notifyError } from "./notifyService.js";
import type { SeriesLibraryEntry } from "../types/seriesLibrary.js";

const ONGOING_TTL_HOURS = 12;
const ENDED_TTL_HOURS = 24 * 7;
const FINISHED_AIR_STATUS = ["Ended", "Canceled"];

async function notifyDueEpisode(entry: SeriesLibraryEntry): Promise<void> {
  const pending = entry.nextAiringEpisode;
  if (!pending) return;
  if (pending.airingAt * 1000 > Date.now()) return;
  if (pending.episode <= (entry.lastNotifiedEpisode ?? 0)) return;
  await notifySeriesNewEpisode(entry, pending.episode, entry.episodes);
  await markSeriesEpisodeNotified(entry.tmdbId, pending.episode);
}

export async function detectAndNotify(old: SeriesLibraryEntry, fresh: SeriesSyncResult): Promise<void> {
  await notifyDueEpisode(old);

  const finishing =
    !fresh.nextAiringEpisode && fresh.airStatus != null && FINISHED_AIR_STATUS.includes(fresh.airStatus);
  if (finishing && old.nextAiringEpisode) {
    void notifySeriesFinished(old, fresh.episodes);
  }
}

export const refreshStaleSeries = singleFlight(doRefresh);

async function doRefresh(): Promise<void> {
  const stale = await findStaleSeries(ONGOING_TTL_HOURS, ENDED_TTL_HOURS);
  if (stale.length === 0) return;

  await Promise.all(
    stale.map(async (entry) => {
      try {
        const fresh = await fetchSeriesSyncData(entry.tmdbId);
        if (entry.syncedAt) await detectAndNotify(entry, fresh);
        await updateSeriesSyncData(entry.tmdbId, {
          episodes: fresh.episodes,
          nextAiringEpisode: fresh.nextAiringEpisode,
          seasonList: fresh.seasonList,
        });
      } catch (error) {
        await notifyError("seriesLibrarySyncService.refreshStaleSeries", error, { tmdbId: String(entry.tmdbId) });
      }
    })
  );
}

export const notifyDueSeriesEpisodes = singleFlight(doNotifyDue);

async function doNotifyDue(): Promise<void> {
  const due = await findDueSeriesEpisodes();
  if (due.length === 0) return;

  await Promise.all(
    due.map(async (entry) => {
      try {
        await notifyDueEpisode(entry);
      } catch (error) {
        await notifyError("seriesLibrarySyncService.notifyDueSeriesEpisodes", error, { tmdbId: String(entry.tmdbId) });
      }
    })
  );
}
