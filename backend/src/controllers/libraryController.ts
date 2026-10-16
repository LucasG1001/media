import type { Request, Response } from "express";
import { createLibraryController } from "../lib/createLibraryController.js";
import * as libraryModel from "../models/libraryModel.js";
import { animeLibraryModel } from "../models/libraryModel.js";
import { discoverFranchise } from "../services/anilistService.js";
import { animeCreateSchema, animeUpdateSchema } from "../schemas/library.js";
import type { CreateLibraryEntry } from "../types/library.js";
import { notifyError } from "../services/notifyService.js";

const base = createLibraryController({
  model: animeLibraryModel,
  externalIdField: "anilistId",
  createSchema: animeCreateSchema,
  updateSchema: animeUpdateSchema,
  messages: {
    required: "anilistId e title são obrigatórios.",
    invalid: "Dados inválidos.",
    duplicate: "Anime já está na biblioteca.",
    notFound: "Anime não encontrado na biblioteca.",
    errorGetAll: "Erro ao buscar biblioteca.",
    errorCreate: "Erro ao adicionar anime à biblioteca.",
    errorUpdate: "Erro ao atualizar anime na biblioteca.",
    errorRemove: "Erro ao remover anime da biblioteca.",
  },
});

// getAll vem da factory, como nas outras mídias: listar a biblioteca não espera
// sincronização. Antes havia um `await refreshStaleEntries()` aqui, o que fazia
// a página de Anime (e o Dashboard, que carrega cinco bibliotecas) travar numa
// ida à AniList com rate limiter de 2 s. Quem sincroniza é o runSyncTick.
export const { getAll, update, updateManyStatus, setCover, remove, removeMany } = base;

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const parsed = animeCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos.", issues: parsed.error.flatten() });
      return;
    }
    const { anilistId, status, score } = parsed.data;

    const existing = await libraryModel.findByAnilistId(anilistId);
    if (existing) {
      res.status(409).json({ error: "Anime já está na biblioteca.", entry: existing });
      return;
    }

    const members = await discoverFranchise(anilistId);

    if (members.length === 0) {
      const entry = await libraryModel.create(parsed.data as unknown as CreateLibraryEntry);
      res.status(201).json([entry]);
      return;
    }

    const franchiseId = Math.min(...members.map((m) => m.id));
    const entries: CreateLibraryEntry[] = members.map((m) => ({
      anilistId: m.id,
      title: m.title,
      coverImage: m.coverImage,
      status: m.id === anilistId ? status ?? "plan_to_watch" : "plan_to_watch",
      score: m.id === anilistId ? score ?? 0 : 0,
      totalEpisodes: m.episodes,
      animeStatus: m.status,
      format: m.format,
      seasonYear: m.seasonYear,
      nextAiringEpisode: m.nextAiringEpisode,
      streamingLinks: m.streamingLinks,
    }));

    const group = await libraryModel.bulkUpsert(entries, franchiseId);
    group.sort((a, b) => (a.anilistId === anilistId ? -1 : b.anilistId === anilistId ? 1 : 0));
    res.status(201).json(group);
  } catch (error) {
    void notifyError("API POST /api/library", error);
    res.status(500).json({ error: "Erro ao adicionar anime à biblioteca." });
  }
}
