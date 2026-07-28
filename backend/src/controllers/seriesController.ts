import type { Request, Response } from "express";
import { fetchPopularSeries, searchSeries, fetchSeriesById, fetchSeasonById } from "../services/tmdbSeriesService.js";
import { notifyError } from "../services/notifyService.js";

export async function getPopular(req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();
    const reqMonth = req.query.month ? parseInt(String(req.query.month)) : NaN;
    const reqYear = req.query.year ? parseInt(String(req.query.year)) : NaN;

    const month = !isNaN(reqMonth) && reqMonth >= 1 && reqMonth <= 12 ? reqMonth : undefined;
    const year = !isNaN(reqYear) ? reqYear : now.getFullYear();

    const page = parseInt(String(req.query.page || "1")) || 1;
    const result = await fetchPopularSeries(year, month, page);
    res.json(result);
  } catch (error) {
    void notifyError("API series/popular", error);
    res.status(500).json({ error: "Erro ao buscar séries populares." });
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
    const result = await searchSeries(query, page);
    res.json(result);
  } catch (error) {
    void notifyError("API series/search", error);
    res.status(500).json({ error: "Erro ao buscar séries." });
  }
}

export async function getById(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido." });
      return;
    }
    const series = await fetchSeriesById(id);
    res.json(series);
  } catch (error) {
    void notifyError("API series/:id", error);
    res.status(500).json({ error: "Erro ao buscar detalhes da série." });
  }
}

export async function getSeasonById(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(String(req.params.id));
    const seasonNumber = parseInt(String(req.params.seasonNumber));
    if (isNaN(id) || isNaN(seasonNumber)) {
      res.status(400).json({ error: "ID inválido." });
      return;
    }
    const season = await fetchSeasonById(id, seasonNumber);
    res.json(season);
  } catch (error) {
    void notifyError("API series/:id/season/:seasonNumber", error);
    res.status(500).json({ error: "Erro ao buscar detalhes da temporada." });
  }
}
