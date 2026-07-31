import type { Request, Response } from "express";
import { createLibraryController } from "../lib/createLibraryController.js";
import {
  youtubeLibraryModel,
  addTagMany,
  removeTagMany,
  bulkUpsertVideos,
  createCollection,
  renameCollection as renameCollectionModel,
  assignCollection,
  removeFromCollection,
  listCollections as listCollectionsModel,
  pruneEmptyCollections,
} from "../models/youtubeLibraryModel.js";
import {
  youtubeCreateSchema,
  youtubeUpdateSchema,
  youtubeFromUrlSchema,
  youtubeBulkTagSchema,
  youtubeFormGroupSchema,
  youtubeAddToGroupSchema,
  youtubeRemoveFromGroupSchema,
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

export const { getAll, create, updateManyStatus, setCover, remove, removeMany } = base;

// Tag só existe dentro de coleção: vídeo avulso tem o campo descartado antes de
// chegar ao model. É o único caminho de escrita de tag que não passa pelos
// endpoints em lote (que já filtram por `collection_id` no próprio UPDATE).
export async function update(req: Request, res: Response): Promise<void> {
  if (req.body && typeof req.body === "object" && "tags" in req.body) {
    const entry = await youtubeLibraryModel.findById(String(req.params.id)).catch(() => null);
    if (entry && entry.collectionId == null) {
      const { tags: _discarded, ...rest } = req.body as Record<string, unknown>;
      req.body = rest;
    }
  }
  await base.update(req, res);
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
      // A playlist vira uma coleção com o nome dela; as tags ficam para depois,
      // já dentro do escopo dessa coleção.
      const collection = await createCollection(title);
      await bulkUpsertVideos(videos, collection.id);
      res
        .status(201)
        .json({ playlist: { name: title, imported: videos.length, collectionId: collection.id } });
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

function bulkTagHandler(
  apply: (ids: string[], tag: string) => Promise<number>,
  context: string,
  errorMessage: string
) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = youtubeBulkTagSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Dados inválidos." });
        return;
      }
      await apply(parsed.data.ids, parsed.data.tag.trim());
      res.json({ ok: true });
    } catch (error) {
      void notifyError(context, error);
      res.status(500).json({ error: errorMessage });
    }
  };
}

export const addTag = bulkTagHandler(
  addTagMany,
  "API POST /api/youtube-library/bulk-add-tag",
  "Erro ao adicionar tag."
);

export const removeTag = bulkTagHandler(
  removeTagMany,
  "API POST /api/youtube-library/bulk-remove-tag",
  "Erro ao remover tag."
);

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
