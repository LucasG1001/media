import { chunk } from "../lib/chunk.js";
import { singleFlight } from "../lib/singleFlight.js";
import { findStaleVideoIds, updateVideoSyncData, markVideosSynced } from "../models/youtubeLibraryModel.js";
import { fetchVideosByIds, YOUTUBE_VIDEOS_BATCH_SIZE } from "./youtubeService.js";
import { notifyError } from "./notifyService.js";

// Vídeo e música do YouTube não têm lançamento para acompanhar: o que envelhece
// é a contagem de visualizações (e, raramente, título e miniatura). Uma volta
// por dia basta.
const YOUTUBE_TTL_HOURS = 24;

export const refreshStaleYoutube = singleFlight(doRefreshYoutube);

async function doRefreshYoutube(): Promise<void> {
  // Sem chave não há o que tentar — e relatar o mesmo erro a cada tick só faria ruído.
  if (!process.env.YOUTUBE_API_KEY) return;

  const stale = await findStaleVideoIds(YOUTUBE_TTL_HOURS);
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
        await updateVideoSyncData(videoId, {
          title: video.title,
          thumbnail: video.thumbnail,
          channelTitle: video.channelTitle,
          durationSeconds: video.durationSeconds,
          viewCount: video.viewCount,
          description: video.description,
        });
      }
      await markVideosSynced(missing);
    } catch (error) {
      await notifyError("youtubeLibrarySyncService.refreshStaleYoutube", error);
    }
  }
}
