import type { Request, Response } from "express";
import { createLibraryController } from "../lib/createLibraryController.js";
import { gameLibraryModel, bulkUpsertGames } from "../models/gameLibraryModel.js";
import { discoverGameCollection, fetchGameModes } from "../services/igdbService.js";
import { gameCreateSchema, gameUpdateSchema } from "../schemas/library.js";
import type { CreateGameLibraryEntry } from "../types/gameLibrary.js";
import { notifyError } from "../services/notifyService.js";

const base = createLibraryController({
  model: gameLibraryModel,
  externalIdField: "igdbId",
  createSchema: gameCreateSchema,
  updateSchema: gameUpdateSchema,
  messages: {
    required: "igdbId e title são obrigatórios.",
    invalid: "Dados inválidos.",
    duplicate: "Jogo já está na biblioteca.",
    notFound: "Jogo não encontrado na biblioteca.",
    errorGetAll: "Erro ao buscar biblioteca.",
    errorCreate: "Erro ao adicionar jogo à biblioteca.",
    errorUpdate: "Erro ao atualizar jogo na biblioteca.",
    errorRemove: "Erro ao remover jogo da biblioteca.",
  },
});

export const { getAll, update, updateManyStatus, setCover, registerAccess, remove, removeMany } = base;

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const parsed = gameCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos.", issues: parsed.error.flatten() });
      return;
    }
    const data = parsed.data as CreateGameLibraryEntry;
    if (!data.igdbId || !data.title) {
      res.status(400).json({ error: "igdbId e title são obrigatórios." });
      return;
    }

    const existing = await gameLibraryModel.findByExternalId(data.igdbId);
    if (existing) {
      res.status(409).json({ error: "Jogo já está na biblioteca.", entry: existing });
      return;
    }

    const collection = await discoverGameCollection(data.igdbId);

    if (!collection) {
      const modes = await fetchGameModes([data.igdbId]);
      const entry = await gameLibraryModel.create({ ...data, gameModes: modes.get(data.igdbId) ?? [] });
      res.status(201).json([entry]);
      return;
    }

    const { collectionId, members } = collection;
    const modes = await fetchGameModes(members.map((m) => m.id));
    const entries: CreateGameLibraryEntry[] = members.map((m) => ({
      igdbId: m.id,
      title: m.title,
      backgroundImage: m.backgroundImage,
      status: m.id === data.igdbId ? data.status ?? "plan_to_play" : "plan_to_play",
      score: m.id === data.igdbId ? data.score ?? 0 : 0,
      released: m.released,
      metacritic: m.metacritic,
      gameStatus: m.gameStatus,
      gameModes: modes.get(m.id) ?? [],
    }));

    const group = await bulkUpsertGames(entries, collectionId);
    group.sort((a, b) => (a.igdbId === data.igdbId ? -1 : b.igdbId === data.igdbId ? 1 : 0));
    res.status(201).json(group);
  } catch (error) {
    void notifyError("API POST /api/game-library", error);
    res.status(500).json({ error: "Erro ao adicionar jogo à biblioteca." });
  }
}
