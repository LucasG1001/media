import type { Request, Response } from "express";
import { createLibraryController } from "../lib/createLibraryController.js";
import { musicLibraryModel, bulkInsertTracks, touchAccess } from "../models/musicLibraryModel.js";
import { musicCreateSchema, musicUpdateSchema, musicFromUrlSchema } from "../schemas/library.js";
import {
  extractVideoId,
  extractPlaylistId,
  fetchVideo,
  fetchPlaylist,
  YoutubeServiceError,
} from "../services/youtubeService.js";
import { notifyError } from "../services/notifyService.js";

const base = createLibraryController({
  model: musicLibraryModel,
  externalIdField: "videoId",
  createSchema: musicCreateSchema,
  updateSchema: musicUpdateSchema,
  messages: {
    required: "videoId e title são obrigatórios.",
    invalid: "Dados inválidos.",
    duplicate: "Música já está na biblioteca.",
    notFound: "Música não encontrada na biblioteca.",
    errorGetAll: "Erro ao buscar biblioteca.",
    errorCreate: "Erro ao adicionar música à biblioteca.",
    errorUpdate: "Erro ao atualizar música na biblioteca.",
    errorRemove: "Erro ao remover música da biblioteca.",
  },
});

export const { getAll, create, update, updateManyStatus, remove, removeMany } = base;

export async function registerAccess(req: Request, res: Response): Promise<void> {
  try {
    const entry = await touchAccess(String(req.params.id));
    if (!entry) {
      res.status(404).json({ error: "Música não encontrada na biblioteca." });
      return;
    }
    res.json(entry);
  } catch (error) {
    void notifyError("API POST /api/music-library/:id/access", error);
    res.status(500).json({ error: "Erro ao registrar acesso à música." });
  }
}

export async function createFromUrl(req: Request, res: Response): Promise<void> {
  try {
    const parsed = musicFromUrlSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Informe a URL da música." });
      return;
    }

    const videoId = extractVideoId(parsed.data.url);

    if (videoId) {
      const existing = await musicLibraryModel.findByExternalId(videoId);
      if (existing) {
        res.status(409).json({ error: "Música já está na biblioteca.", entry: existing });
        return;
      }
      const video = await fetchVideo(videoId);
      const entry = await musicLibraryModel.create({ ...video, status: "liked", score: 0 });
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
      const imported = await bulkInsertTracks(videos);
      res.status(201).json({ playlist: { name: title, imported, total: videos.length } });
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
    void notifyError("API POST /api/music-library/from-url", error);
    res.status(500).json({ error: "Erro ao adicionar música à biblioteca." });
  }
}
