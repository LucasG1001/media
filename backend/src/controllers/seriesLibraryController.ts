import type { Request, Response } from "express";
import { createLibraryController } from "../lib/createLibraryController.js";
import { seriesLibraryModel, setSeasonState, setSeasonNotes, setSeasonList, setCoverSeason, touchSeasonAccess } from "../models/seriesLibraryModel.js";
import { fetchSeriesById } from "../services/tmdbSeriesService.js";
import { seriesCreateSchema, seriesUpdateSchema } from "../schemas/library.js";
import type { CreateSeriesLibraryEntry } from "../types/seriesLibrary.js";
import { notifyError } from "../services/notifyService.js";

const base = createLibraryController({
  model: seriesLibraryModel,
  externalIdField: "tmdbId",
  createSchema: seriesCreateSchema,
  updateSchema: seriesUpdateSchema,
  messages: {
    required: "tmdbId e title são obrigatórios.",
    invalid: "Dados inválidos.",
    duplicate: "Série já está na biblioteca.",
    notFound: "Série não encontrada na biblioteca.",
    errorGetAll: "Erro ao buscar biblioteca.",
    errorCreate: "Erro ao adicionar série à biblioteca.",
    errorUpdate: "Erro ao atualizar série na biblioteca.",
    errorRemove: "Erro ao remover série da biblioteca.",
  },
});

export const { getAll, update, updateManyStatus, registerAccess, remove, removeMany } = base;

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const parsed = seriesCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos.", issues: parsed.error.flatten() });
      return;
    }
    const data = parsed.data as CreateSeriesLibraryEntry;
    if (!data.tmdbId || !data.title) {
      res.status(400).json({ error: "tmdbId e title são obrigatórios." });
      return;
    }

    const existing = await seriesLibraryModel.findByExternalId(data.tmdbId);
    if (existing) {
      res.status(409).json({ error: "Série já está na biblioteca.", entry: existing });
      return;
    }

    // As temporadas já vêm no detalhe do TMDB — guardamos para renderizar a
    // coleção sem nova chamada por card. season_list é readonly na factory, então
    // grava-se à parte (JSONB exige JSON.stringify explícito).
    const detail = await fetchSeriesById(data.tmdbId);
    const entry = await seriesLibraryModel.create(data);
    await setSeasonList(entry.id, detail.seasonList);
    res.status(201).json({ ...entry, seasonList: detail.seasonList });
  } catch (error) {
    void notifyError("API POST /api/series-library", error);
    res.status(500).json({ error: "Erro ao adicionar série à biblioteca." });
  }
}

const SEASON_STATUSES = ["plan_to_watch", "watched", "dropped"];

export async function saveSeason(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const seasonNumber = Number(req.params.seasonNumber);
    const body = req.body as { status?: unknown; score?: unknown };
    const status = String(body.status);
    const score = Number(body.score);

    if (!Number.isInteger(seasonNumber) || seasonNumber < 0) {
      res.status(400).json({ error: "Temporada inválida." });
      return;
    }
    if (!SEASON_STATUSES.includes(status)) {
      res.status(400).json({ error: "Status inválido." });
      return;
    }
    if (!Number.isFinite(score) || score < 0 || score > 10) {
      res.status(400).json({ error: "Nota inválida." });
      return;
    }

    const entry = await setSeasonState(id, seasonNumber, {
      status: status as "plan_to_watch" | "watched" | "dropped",
      score,
    });
    if (!entry) {
      res.status(404).json({ error: "Série não encontrada na biblioteca." });
      return;
    }
    res.json(entry);
  } catch (error) {
    void notifyError("API PUT /api/series-library/:id/seasons/:seasonNumber", error);
    res.status(500).json({ error: "Erro ao salvar temporada." });
  }
}

// "Assisti de novo" da temporada: nem status nem nota no corpo.
export async function registerSeasonAccess(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const seasonNumber = Number(req.params.seasonNumber);
    if (!Number.isInteger(seasonNumber) || seasonNumber < 0) {
      res.status(400).json({ error: "Temporada inválida." });
      return;
    }
    const entry = await touchSeasonAccess(id, seasonNumber);
    if (!entry) {
      res.status(404).json({ error: "Série não encontrada na biblioteca." });
      return;
    }
    res.json(entry);
  } catch (error) {
    void notifyError("API POST /api/series-library/:id/seasons/:seasonNumber/access", error);
    res.status(500).json({ error: "Erro ao registrar acesso à temporada." });
  }
}

// Endpoint próprio, separado do saveSeason: o autosave da anotação não deve
// carregar status/nota, que o saveSeason exige válidos.
export async function saveSeasonNotes(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const seasonNumber = Number(req.params.seasonNumber);
    const { notes } = req.body as { notes?: unknown };

    if (!Number.isInteger(seasonNumber) || seasonNumber < 0) {
      res.status(400).json({ error: "Temporada inválida." });
      return;
    }
    if (notes != null && (typeof notes !== "string" || notes.length > 20000)) {
      res.status(400).json({ error: "Anotação inválida." });
      return;
    }

    const entry = await setSeasonNotes(id, seasonNumber, (notes as string | null | undefined) ?? null);
    if (!entry) {
      res.status(404).json({ error: "Série não encontrada na biblioteca." });
      return;
    }
    res.json(entry);
  } catch (error) {
    void notifyError("API PUT /api/series-library/:id/seasons/:seasonNumber/notes", error);
    res.status(500).json({ error: "Erro ao salvar anotação da temporada." });
  }
}

export async function setSeasonCover(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const seasonNumber = Number(req.params.seasonNumber);
    if (!Number.isInteger(seasonNumber) || seasonNumber < 0) {
      res.status(400).json({ error: "Temporada inválida." });
      return;
    }

    const entry = await setCoverSeason(id, seasonNumber);
    if (!entry) {
      res.status(404).json({ error: "Série não encontrada na biblioteca." });
      return;
    }
    res.json(entry);
  } catch (error) {
    void notifyError("API PUT /api/series-library/:id/cover-season/:seasonNumber", error);
    res.status(500).json({ error: "Erro ao definir capa da coleção." });
  }
}
