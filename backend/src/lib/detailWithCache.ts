import type { Response } from "express";
import type { DetailCache } from "../models/detailCacheModel.js";
import { notifyError } from "../services/notifyService.js";
import { isHttpNotFound } from "./httpClient.js";

const DETAIL_PATH = ["detail"];

// Responde o detalhe da API externa e guarda a resposta na linha da biblioteca
// (o UPDATE não casa nada se o item não estiver salvo). Quando a API falha e há
// cache, responde o cache — é o que mantém o drawer inteiro com a API fora.
export async function serveDetail<T>(
  res: Response,
  cache: DetailCache,
  externalId: number,
  fetchDetail: () => Promise<T>,
  path: string[] = DETAIL_PATH
): Promise<void> {
  try {
    const detail = await fetchDetail();
    void cache.save(externalId, path, detail).catch((error) => notifyError("detailCache.save", error));
    res.json(detail);
  } catch (error) {
    const cached = await cache.find(externalId, path).catch(() => null);
    if (cached === null) throw error;
    // 404 é item apagado da API externa, não indisponibilidade: o cache é a
    // resposta definitiva e avisar a cada abertura do drawer seria só ruído.
    if (!isHttpNotFound(error)) {
      void notifyError("detailCache.fallback", error, { externalId: String(externalId) });
    }
    res.setHeader("X-From-Cache", "1");
    res.json(cached);
  }
}
