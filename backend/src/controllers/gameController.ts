import type { Request, Response } from "express";
import { fetchPopularGames, fetchUpcomingGames, searchGames, fetchGameById } from "../services/igdbService.js";
import { notifyError } from "../services/notifyService.js";
import { openImage } from "../lib/imageStore.js";
import { getCachedImage } from "../services/imageCacheService.js";
import { serveDetail } from "../lib/detailWithCache.js";
import { gameDetailCache } from "../models/detailCacheModel.js";

const IGDB_IMAGE_BASE = "https://images.igdb.com/igdb/image/upload";
const IMAGE_SIZE_RE = /^t_[a-z0-9_]+$/;
const IMAGE_FILE_RE = /^[a-z0-9]+\.(jpg|png|webp)$/i;

// A rota continua existindo porque game_library.background_image já guarda este
// caminho; o que mudou é que os bytes passam pelo cache em disco.
export async function proxyImage(req: Request, res: Response): Promise<void> {
  try {
    const size = String(req.params.size);
    const file = String(req.params.file);
    if (!IMAGE_SIZE_RE.test(size) || !IMAGE_FILE_RE.test(file)) {
      res.status(400).json({ error: "Imagem inválida." });
      return;
    }

    const cached = await getCachedImage(`${IGDB_IMAGE_BASE}/${size}/${file}`);
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
  } catch (error) {
    void notifyError("API game/image", error);
    res.status(502).json({ error: "Erro ao carregar imagem." });
  }
}

export async function getPopular(req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();
    const reqMonth = req.query.month ? parseInt(String(req.query.month)) : NaN;
    const reqYear = req.query.year ? parseInt(String(req.query.year)) : NaN;

    const month = !isNaN(reqMonth) && reqMonth >= 1 && reqMonth <= 12 ? reqMonth : undefined;
    const year = !isNaN(reqYear) ? reqYear : now.getFullYear();

    const page = parseInt(String(req.query.page || "1")) || 1;
    const result = await fetchPopularGames(year, month, page);
    res.json(result);
  } catch (error) {
    void notifyError("API game/popular", error);
    res.status(500).json({ error: "Erro ao buscar jogos populares." });
  }
}

export async function getUpcoming(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(String(req.query.page || "1")) || 1;
    const result = await fetchUpcomingGames(page);
    res.json(result);
  } catch (error) {
    void notifyError("API game/upcoming", error);
    res.status(500).json({ error: "Erro ao buscar lançamentos." });
  }
}

export async function search(req: Request, res: Response): Promise<void> {
  try {
    const query = String(req.query.q || "");
    if (!query) {
      res.status(400).json({ error: "Parâmetro de busca é obrigatório." });
      return;
    }
    const page = parseInt(String(req.query.page || "1")) || 1;
    const result = await searchGames(query, page);
    res.json(result);
  } catch (error) {
    void notifyError("API game/search", error);
    res.status(500).json({ error: "Erro ao buscar jogos." });
  }
}

export async function getById(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido." });
      return;
    }
    await serveDetail(res, gameDetailCache, id, () => fetchGameById(id));
  } catch (error) {
    void notifyError("API game/:id", error);
    res.status(500).json({ error: "Erro ao buscar detalhes do jogo." });
  }
}
