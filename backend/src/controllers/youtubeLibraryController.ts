import type { Request, Response } from "express";
import { createLibraryController } from "../lib/createLibraryController.js";
import {
  youtubeLibraryModel,
  addTagMany,
  removeTagMany,
  bulkUpsertVideos,
} from "../models/youtubeLibraryModel.js";
import {
  youtubeCreateSchema,
  youtubeUpdateSchema,
  youtubeFromUrlSchema,
  youtubeBulkTagSchema,
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

export const { getAll, create, update, updateManyStatus, remove, removeMany } = base;

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
      // Sem coleção: o nome da playlist entra como tag dos vídeos.
      await bulkUpsertVideos(videos, title);
      res.status(201).json({ playlist: { name: title, imported: videos.length } });
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
