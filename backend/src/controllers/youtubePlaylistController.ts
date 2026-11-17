import type { Request, Response } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import * as playlistModel from "../models/youtubePlaylistModel.js";
import {
  youtubePlaylistCreateSchema,
  youtubePlaylistRenameSchema,
  youtubePlaylistItemsSchema,
  youtubePlaylistIdSchema,
} from "../schemas/library.js";

const NOT_FOUND = "Playlist não encontrada.";
const DUPLICATE = "Já existe uma playlist com esse nome.";

// Id que não é uuid não existe: responde 404 em vez de deixar o cast estourar.
function playlistId(req: Request, res: Response): string | null {
  const parsed = youtubePlaylistIdSchema.safeParse(req.params.id);
  if (!parsed.success) {
    res.status(404).json({ error: NOT_FOUND });
    return null;
  }
  return parsed.data;
}

export const getAll = asyncHandler("API GET /api/youtube-library/playlists", "Erro ao buscar playlists.", async (_req, res) => {
  res.json(await playlistModel.findAll());
});

export const create = asyncHandler("API POST /api/youtube-library/playlists", "Erro ao criar playlist.", async (req, res) => {
  const parsed = youtubePlaylistCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Informe o nome e o tipo da playlist." });
    return;
  }
  const { name, kind, entryIds } = parsed.data;
  const existing = await playlistModel.findByName(kind, name);
  if (existing) {
    res.status(409).json({ error: DUPLICATE, playlist: existing });
    return;
  }
  res.status(201).json(await playlistModel.create(name, kind, entryIds ?? []));
});

export const rename = asyncHandler("API PUT /api/youtube-library/playlists/:id", "Erro ao renomear playlist.", async (req, res) => {
  const id = playlistId(req, res);
  if (!id) return;
  const parsed = youtubePlaylistRenameSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Informe o nome da playlist." });
    return;
  }
  const current = await playlistModel.findById(id);
  if (!current) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }
  const sameName = await playlistModel.findByName(current.kind, parsed.data.name);
  if (sameName && sameName.id !== id) {
    res.status(409).json({ error: DUPLICATE });
    return;
  }
  res.json(await playlistModel.rename(id, parsed.data.name));
});

export const remove = asyncHandler("API DELETE /api/youtube-library/playlists/:id", "Erro ao excluir playlist.", async (req, res) => {
  const id = playlistId(req, res);
  if (!id) return;
  if (!(await playlistModel.remove(id))) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }
  res.status(204).send();
});

function itemsHandler(
  context: string,
  fallback: string,
  apply: typeof playlistModel.addItems
): (req: Request, res: Response) => Promise<void> {
  return asyncHandler(context, fallback, async (req, res) => {
    const id = playlistId(req, res);
    if (!id) return;
    const parsed = youtubePlaylistItemsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Informe os itens da playlist." });
      return;
    }
    const playlist = await apply(id, parsed.data.entryIds);
    if (!playlist) {
      res.status(404).json({ error: NOT_FOUND });
      return;
    }
    res.json(playlist);
  });
}

export const addItems = itemsHandler(
  "API POST /api/youtube-library/playlists/:id/items",
  "Erro ao adicionar à playlist.",
  playlistModel.addItems
);

export const removeItems = itemsHandler(
  "API POST /api/youtube-library/playlists/:id/items/remove",
  "Erro ao tirar da playlist.",
  playlistModel.removeItems
);
