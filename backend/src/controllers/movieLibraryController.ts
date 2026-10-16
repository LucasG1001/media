import type { Request, Response } from "express";
import { createLibraryController } from "../lib/createLibraryController.js";
import { movieLibraryModel, bulkUpsertMovies } from "../models/movieLibraryModel.js";
import { discoverCollection } from "../services/tmdbService.js";
import { movieCreateSchema, movieUpdateSchema } from "../schemas/library.js";
import type { CreateMovieLibraryEntry } from "../types/movieLibrary.js";
import { notifyError } from "../services/notifyService.js";

const base = createLibraryController({
  model: movieLibraryModel,
  externalIdField: "tmdbId",
  createSchema: movieCreateSchema,
  updateSchema: movieUpdateSchema,
  messages: {
    required: "tmdbId e title são obrigatórios.",
    invalid: "Dados inválidos.",
    duplicate: "Filme já está na biblioteca.",
    notFound: "Filme não encontrado na biblioteca.",
    errorGetAll: "Erro ao buscar biblioteca.",
    errorCreate: "Erro ao adicionar filme à biblioteca.",
    errorUpdate: "Erro ao atualizar filme na biblioteca.",
    errorRemove: "Erro ao remover filme da biblioteca.",
  },
});

export const { getAll, update, updateManyStatus, setCover, remove, removeMany } = base;

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const parsed = movieCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos.", issues: parsed.error.flatten() });
      return;
    }
    const data = parsed.data as CreateMovieLibraryEntry;
    if (!data.tmdbId || !data.title) {
      res.status(400).json({ error: "tmdbId e title são obrigatórios." });
      return;
    }

    const existing = await movieLibraryModel.findByExternalId(data.tmdbId);
    if (existing) {
      res.status(409).json({ error: "Filme já está na biblioteca.", entry: existing });
      return;
    }

    const collection = await discoverCollection(data.tmdbId);

    if (!collection) {
      const entry = await movieLibraryModel.create(data);
      res.status(201).json([entry]);
      return;
    }

    const { collectionId, members } = collection;
    const entries: CreateMovieLibraryEntry[] = members.map((m) => ({
      tmdbId: m.id,
      title: m.title,
      posterImage: m.posterImage,
      status: m.id === data.tmdbId ? data.status ?? "plan_to_watch" : "plan_to_watch",
      score: m.id === data.tmdbId ? data.score ?? 0 : 0,
      releaseDate: m.releaseDate,
      movieStatus: m.movieStatus,
    }));

    const group = await bulkUpsertMovies(entries, collectionId);
    group.sort((a, b) => (a.tmdbId === data.tmdbId ? -1 : b.tmdbId === data.tmdbId ? 1 : 0));
    res.status(201).json(group);
  } catch (error) {
    void notifyError("API POST /api/movie-library", error);
    res.status(500).json({ error: "Erro ao adicionar filme à biblioteca." });
  }
}
