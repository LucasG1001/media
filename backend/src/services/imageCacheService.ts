import {
  downloadImage,
  hashUrl,
  isAllowedImageUrl,
  statCached,
  storeImage,
} from "../lib/imageStore.js";
import {
  findImageCache,
  markImageFailure,
  saveImageCache,
  touchImageHit,
} from "../models/imageCacheModel.js";

export interface CachedImage {
  hash: string;
  contentType: string;
}

const FAILURE_BACKOFF_MS = 24 * 60 * 60 * 1000;

// Abrir um grid pede a mesma capa dezenas de vezes em paralelo. Sem este mapa
// cada uma abriria um download próprio e todas escreveriam o mesmo arquivo.
const inFlight = new Map<string, Promise<CachedImage | null>>();
const recentFailures = new Map<string, number>();

export async function getCachedImage(url: string): Promise<CachedImage | null> {
  if (!isAllowedImageUrl(url)) return null;
  const hash = hashUrl(url);

  const row = await findImageCache(hash);
  if (row?.contentType && (await statCached(hash)) !== null) {
    void touchImageHit(hash).catch(() => undefined);
    return { hash, contentType: row.contentType };
  }

  const failedAt = recentFailures.get(hash);
  if (failedAt !== undefined && Date.now() - failedAt < FAILURE_BACKOFF_MS) return null;

  const pending = inFlight.get(hash);
  if (pending) return pending;

  const download = fetchAndStore(url, hash).finally(() => {
    inFlight.delete(hash);
  });
  inFlight.set(hash, download);
  return download;
}

export async function fetchAndStore(url: string, hash: string): Promise<CachedImage | null> {
  try {
    const image = await downloadImage(url);
    await storeImage(hash, image.buffer);
    await saveImageCache(hash, url, image.contentType, image.buffer.byteLength);
    recentFailures.delete(hash);
    return { hash, contentType: image.contentType };
  } catch {
    recentFailures.set(hash, Date.now());
    await markImageFailure(hash, url).catch(() => undefined);
    return null;
  }
}
