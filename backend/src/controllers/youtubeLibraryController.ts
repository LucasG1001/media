import type { Request, Response } from "express";
import { createLibraryController } from "../lib/createLibraryController.js";
import { youtubeLibraryModel, touchAccess, bulkInsertVideos } from "../models/youtubeLibraryModel.js";
import { youtubeCreateSchema, youtubeUpdateSchema, youtubeFromUrlSchema } from "../schemas/library.js";
import {
  extractVideoId,
  extractPlaylistId,
  fetchVideo,
  fetchPlaylist,
  YoutubeServiceError,
} from "../services/youtubeService.js";
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

// No YouTube o acesso é tocar o item, não mudar de status.
export async function registerAccess(req: Request, res: Response): Promise<void> {
  try {
    const entry = await touchAccess(String(req.params.id));
    if (!entry) {
      res.status(404).json({ error: "Vídeo não encontrado na biblioteca." });
      return;
    }
    res.json(entry);
  } catch (error) {
    void notifyError("API POST /api/youtube-library/:id/access", error);
    res.status(500).json({ error: "Erro ao registrar acesso ao vídeo." });
  }
}

export async function createFromUrl(req: Request, res: Response): Promise<void> {
  try {
    const parsed = youtubeFromUrlSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Informe a URL do vídeo." });
      return;
    }
    const kind = parsed.data.kind ?? "video";
    const videoId = extractVideoId(parsed.data.url);

    if (videoId) {
      const existing = await youtubeLibraryModel.findByExternalId(videoId);
      if (existing) {
        res.status(409).json({ error: "Vídeo já está na biblioteca.", entry: existing });
        return;
      }
      const video = await fetchVideo(videoId);
      const entry = await youtubeLibraryModel.create({ ...video, kind, status: "liked", score: 0 });
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
      const imported = await bulkInsertVideos(videos, kind);
      // `videoIds` vai na ordem da playlist do YouTube, inclusive os que já
      // estavam na biblioteca: é com eles que a tela oferece criar a playlist.
      res.status(201).json({
        playlist: { name: title, imported, total: videos.length, videoIds: videos.map((video) => video.videoId) },
      });
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
