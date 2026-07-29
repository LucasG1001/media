import type { Request, Response } from "express";
import { createLibraryController } from "../lib/createLibraryController.js";
import {
  youtubeLibraryModel,
  createCollection,
  renameCollection as renameCollectionModel,
  assignCollection,
  assignTag,
  removeFromCollection,
  bulkUpsertVideos,
  listCollections as listCollectionsModel,
  pruneEmptyCollections,
} from "../models/youtubeLibraryModel.js";
import {
  youtubeCreateSchema,
  youtubeUpdateSchema,
  youtubeFromUrlSchema,
  youtubeFormGroupSchema,
  youtubeAddToGroupSchema,
  youtubeRemoveFromGroupSchema,
  youtubeSetTagSchema,
  youtubeRenameSchema,
} from "../schemas/library.js";
import { extractVideoId, extractPlaylistId, fetchVideo, fetchPlaylist, YoutubeServiceError } from "../services/youtubeService.js";
import { notifyError } from "../services/notifyService.js";

const base = createLibraryController({
  model: youtubeLibraryModel,
  externalIdField: "videoId",
  createSchema: youtubeCreateSchema,
  updateSchema: youtubeUpdateSchema,
  messages: {
    required: "videoId e title são obrigatórios.",
    invalid: "Dados inválidos.",
    duplicate: "Vídeo já está na biblioteca.",
    notFound: "Vídeo não encontrado na biblioteca.",
    errorGetAll: "Erro ao buscar biblioteca.",
    errorCreate: "Erro ao adicionar vídeo à biblioteca.",
    errorUpdate: "Erro ao atualizar vídeo na biblioteca.",
    errorRemove: "Erro ao remover vídeo da biblioteca.",
  },
});

export const { getAll, create, update, updateManyStatus, setCover } = base;

export async function remove(req: Request, res: Response): Promise<void> {
  await base.remove(req, res);
  if (res.statusCode === 204) await pruneEmptyCollections().catch(() => undefined);
}

export async function removeMany(req: Request, res: Response): Promise<void> {
  await base.removeMany(req, res);
  await pruneEmptyCollections().catch(() => undefined);
}

export async function createFromUrl(req: Request, res: Response): Promise<void> {
  try {
    const parsed = youtubeFromUrlSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Informe a URL do vídeo." });
      return;
    }

    const videoId = extractVideoId(parsed.data.url);

    if (videoId) {
      const existing = await youtubeLibraryModel.findByExternalId(videoId);
      if (existing) {
        res.status(409).json({ error: "Vídeo já está na biblioteca.", entry: existing });
        return;
      }
      const video = await fetchVideo(videoId);
      const entry = await youtubeLibraryModel.create({ ...video, status: "liked", score: 0 });
      res.status(201).json(entry);
      return;
    }

    const playlistId = extractPlaylistId(parsed.data.url);
    if (playlistId) {
      const { title, videos } = await fetchPlaylist(playlistId);
      if (videos.length === 0) {
        res.status(404).json({ error: "Playlist vazia ou indisponível." });
        return;
      }
      const collection = await createCollection(title);
      await bulkUpsertVideos(videos, collection.id);
      res.status(201).json({ playlist: { name: title, imported: videos.length, collectionId: collection.id } });
      return;
    }

    res.status(400).json({ error: "URL do YouTube inválida." });
  } catch (error) {
    if (error instanceof YoutubeServiceError) {
      if (error.code === "not_found") {
        res.status(404).json({ error: "Vídeo não encontrado no YouTube." });
        return;
      }
      if (error.code === "missing_key") {
        res.status(500).json({ error: "Integração com o YouTube não está configurada." });
        return;
      }
    }
    void notifyError("API POST /api/youtube-library/from-url", error);
    res.status(500).json({ error: "Erro ao adicionar vídeo à biblioteca." });
  }
}

export async function formGroup(req: Request, res: Response): Promise<void> {
  try {
    const parsed = youtubeFormGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos." });
      return;
    }
    const { ids, name } = parsed.data;
    const collection = await createCollection(name.trim());
    await assignCollection(ids, collection.id);
    await pruneEmptyCollections().catch(() => undefined);
    res.status(201).json({ collection });
  } catch (error) {
    void notifyError("API POST /api/youtube-library/collections", error);
    res.status(500).json({ error: "Erro ao criar coleção." });
  }
}

export async function addToGroup(req: Request, res: Response): Promise<void> {
  try {
    const parsed = youtubeAddToGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos." });
      return;
    }
    const { ids, collectionId } = parsed.data;
    await assignCollection(ids, collectionId);
    await pruneEmptyCollections().catch(() => undefined);
    res.json({ ok: true });
  } catch (error) {
    void notifyError("API POST /api/youtube-library/collections/add", error);
    res.status(500).json({ error: "Erro ao adicionar à coleção." });
  }
}

export async function removeFromGroup(req: Request, res: Response): Promise<void> {
  try {
    const parsed = youtubeRemoveFromGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos." });
      return;
    }
    await removeFromCollection(parsed.data.ids);
    await pruneEmptyCollections().catch(() => undefined);
    res.json({ ok: true });
  } catch (error) {
    void notifyError("API POST /api/youtube-library/collections/remove", error);
    res.status(500).json({ error: "Erro ao remover da coleção." });
  }
}

export async function setTagMany(req: Request, res: Response): Promise<void> {
  try {
    const parsed = youtubeSetTagSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos." });
      return;
    }
    const { ids, tag } = parsed.data;
    await assignTag(ids, tag);
    res.json({ ok: true });
  } catch (error) {
    void notifyError("API POST /api/youtube-library/bulk-set-tag", error);
    res.status(500).json({ error: "Erro ao definir tag." });
  }
}

export async function renameCollection(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Coleção inválida." });
      return;
    }
    const parsed = youtubeRenameSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Informe o nome da coleção." });
      return;
    }
    const collection = await renameCollectionModel(id, parsed.data.name.trim());
    if (!collection) {
      res.status(404).json({ error: "Coleção não encontrada." });
      return;
    }
    res.json({ collection });
  } catch (error) {
    void notifyError("API PUT /api/youtube-library/collections/:id", error);
    res.status(500).json({ error: "Erro ao renomear coleção." });
  }
}

export async function listCollections(_req: Request, res: Response): Promise<void> {
  try {
    res.json(await listCollectionsModel());
  } catch (error) {
    void notifyError("API GET /api/youtube-library/collections", error);
    res.status(500).json({ error: "Erro ao buscar coleções." });
  }
}
