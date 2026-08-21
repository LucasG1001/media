import { asyncHandler } from "../lib/asyncHandler.js";
import { isAllowedImageUrl, openImage } from "../lib/imageStore.js";
import { getCachedImage } from "../services/imageCacheService.js";
import { getImageCacheStats } from "../models/imageCacheModel.js";

export const getImage = asyncHandler("API img", "Erro ao carregar imagem.", async (req, res) => {
  const url = String(req.query.u ?? "");
  if (!url || !isAllowedImageUrl(url)) {
    res.status(400).json({ error: "Imagem inválida." });
    return;
  }

  const cached = await getCachedImage(url);
  // 404 e não 502: sem a imagem o front cai no placeholder pelo onError, e um
  // 5xx faria o Service Worker tratar como falha de rede.
  if (!cached) {
    res.status(404).json({ error: "Imagem não disponível." });
    return;
  }

  const etag = `"${cached.hash}"`;
  res.setHeader("Content-Type", cached.contentType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("ETag", etag);
  if (req.headers["if-none-match"] === etag) {
    res.status(304).end();
    return;
  }
  openImage(cached.hash).pipe(res);
});

export const getStats = asyncHandler("API img/stats", "Erro ao ler o cache de imagens.", async (_req, res) => {
  res.json(await getImageCacheStats());
});
