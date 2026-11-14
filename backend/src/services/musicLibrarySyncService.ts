import { chunk } from "../lib/chunk.js";
import { singleFlight } from "../lib/singleFlight.js";
import { findStaleMusicVideoIds, updateMusicSyncData, markMusicSynced } from "../models/musicLibraryModel.js";
import { fetchVideosByIds, YOUTUBE_VIDEOS_BATCH_SIZE } from "./youtubeService.js";
import { notifyError } from "./notifyService.js";

// Música não tem lançamento para acompanhar: o que envelhece é a contagem de
// visualizações (e, raramente, título e miniatura). Uma volta por dia basta.
const MUSIC_TTL_HOURS = 24;

export const refreshStaleMusic = singleFlight(doRefreshMusic);

async function doRefreshMusic(): Promise<void> {
  // Sem chave não há o que tentar — e relatar o mesmo erro a cada tick só faria ruído.
  if (!process.env.YOUTUBE_API_KEY) return;

  const stale = await findStaleMusicVideoIds(MUSIC_TTL_HOURS);
  if (stale.length === 0) return;

  for (const batch of chunk(stale, YOUTUBE_VIDEOS_BATCH_SIZE)) {
    try {
      const fresh = await fetchVideosByIds(batch);
      const missing: string[] = [];
      for (const videoId of batch) {
        const video = fresh.get(videoId);
        if (!video) {
          missing.push(videoId);
          continue;
        }
        await updateMusicSyncData(videoId, {
          title: video.title,
          thumbnail: video.thumbnail,
          channelTitle: video.channelTitle,
          durationSeconds: video.durationSeconds,
          viewCount: video.viewCount,
          description: video.description,
        });
      }
      await markMusicSynced(missing);
    } catch (error) {
      await notifyError("musicLibrarySyncService.refreshStaleMusic", error);
    }
  }
}
