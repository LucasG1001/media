import { chunk } from "../lib/chunk.js";
import { singleFlight } from "../lib/singleFlight.js";
import { hashUrl, isAllowedImageUrl, removeImage, statCached } from "../lib/imageStore.js";
import {
  deleteImageCache,
  findRecentFailures,
  findReferencedImageUrls,
  findStaleImageCache,
} from "../models/imageCacheModel.js";
import { fetchAndStore } from "./imageCacheService.js";
import { notifyError } from "./notifyService.js";

const IGDB_PROXY_PREFIX = "/api/game/image";
const IGDB_IMAGE_BASE = "https://images.igdb.com/igdb/image/upload";

const CONCURRENCY = 6;
const RUN_LIMIT = 300;
const FAILURE_BACKOFF_HOURS = 24;
const PRUNE_UNUSED_DAYS = 90;

export const warmupImages = singleFlight(doWarmupImages);

// game_library grava o caminho do proxy, não a URL da IGDB (ver migrate.ts).
function toAbsolute(url: string): string {
  if (url.startsWith(IGDB_PROXY_PREFIX)) return url.replace(IGDB_PROXY_PREFIX, IGDB_IMAGE_BASE);
  return url;
}

async function doWarmupImages(): Promise<void> {
  const referenced = (await findReferencedImageUrls()).map(toAbsolute).filter(isAllowedImageUrl);
  const referencedHashes = new Set(referenced.map(hashUrl));

  await downloadMissing(referenced);
  await pruneUnreferenced(referencedHashes);
}

async function downloadMissing(referenced: string[]): Promise<void> {
  const failed = await findRecentFailures(FAILURE_BACKOFF_HOURS);

  const pending: string[] = [];
  for (const url of referenced) {
    if (pending.length >= RUN_LIMIT) break;
    const hash = hashUrl(url);
    if (failed.has(hash)) continue;
    if ((await statCached(hash)) !== null) continue;
    pending.push(url);
  }
  if (pending.length === 0) return;

  for (const batch of chunk(pending, CONCURRENCY)) {
    await Promise.all(
      batch.map(async (url) => {
        try {
          await fetchAndStore(url, hashUrl(url));
        } catch (error) {
          await notifyError("imageWarmupService.downloadMissing", error, { url });
        }
      })
    );
  }
}

// Banner, screenshot, still de episódio e ícone de streaming são cacheados sob
// demanda e nunca aparecem em findReferencedImageUrls. A janela de last_hit_at é
// o que impede o prune de apagar exatamente esses.
async function pruneUnreferenced(referencedHashes: Set<string>): Promise<void> {
  const stale = await findStaleImageCache(PRUNE_UNUSED_DAYS);
  const orphans = stale.filter((entry) => !referencedHashes.has(entry.urlHash));
  if (orphans.length === 0) return;

  for (const entry of orphans) {
    await removeImage(entry.urlHash);
  }
  await deleteImageCache(orphans.map((entry) => entry.urlHash));
}
