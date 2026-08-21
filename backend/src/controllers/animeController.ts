import { fetchSeasonAnimes, fetchPopularAnimes, searchAnimes, fetchAnimeById, getCurrentSeason } from "../services/anilistService.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { serveDetail } from "../lib/detailWithCache.js";
import { animeDetailCache } from "../models/detailCacheModel.js";

const VALID_SEASONS = new Set(["WINTER", "SPRING", "SUMMER", "FALL"]);

export const getSeason = asyncHandler("API anime/season", "Erro ao buscar animes da temporada.", async (req, res) => {
  const reqSeason = req.query.season as string | undefined;
  const reqYear = req.query.year ? parseInt(String(req.query.year)) : NaN;

  let season: string;
  let year: number;

  if (reqSeason && !isNaN(reqYear)) {
    season = reqSeason.toUpperCase();
    if (!VALID_SEASONS.has(season)) {
      res.status(400).json({ error: "Temporada inválida." });
      return;
    }
    year = reqYear;
  } else {
    const current = getCurrentSeason();
    season = current.season;
    year = current.year;
  }

  const page = parseInt(String(req.query.page || "1")) || 1;
  const result = await fetchSeasonAnimes(season, year, page);
  res.json(result);
});

export const getPopular = asyncHandler("API anime/popular", "Erro ao buscar animes populares.", async (req, res) => {
  const reqYear = parseInt(String(req.query.year));
  const year = !isNaN(reqYear) ? reqYear : undefined;
  const page = parseInt(String(req.query.page || "1")) || 1;
  const result = await fetchPopularAnimes(page, year);
  res.json(result);
});

export const search = asyncHandler("API anime/search", "Erro ao buscar animes.", async (req, res) => {
  const query = String(req.query.q || "");
  if (!query) {
    res.status(400).json({ error: "Parâmetro de busca é obrigatório." });
    return;
  }
  const page = parseInt(String(req.query.page || "1")) || 1;
  const result = await searchAnimes(query, page);
  res.json(result);
});

export const getById = asyncHandler("API anime/:id", "Erro ao buscar detalhes do anime.", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }
  await serveDetail(res, animeDetailCache, id, () => fetchAnimeById(id));
});
