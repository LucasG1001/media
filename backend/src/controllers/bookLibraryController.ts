import type { Request, Response } from "express";
import { createLibraryController } from "../lib/createLibraryController.js";
import { bookLibraryModel, bulkUpsertBooks } from "../models/bookLibraryModel.js";
import { discoverBookSeries } from "../services/hardcoverService.js";
import { bookCreateSchema, bookUpdateSchema } from "../schemas/library.js";
import type { CreateBookLibraryEntry } from "../types/bookLibrary.js";
import { notifyError } from "../services/notifyService.js";

const base = createLibraryController({
  model: bookLibraryModel,
  externalIdField: "hardcoverId",
  createSchema: bookCreateSchema,
  updateSchema: bookUpdateSchema,
  messages: {
    required: "hardcoverId e title são obrigatórios.",
    invalid: "Dados inválidos.",
    duplicate: "Livro já está na biblioteca.",
    notFound: "Livro não encontrado na biblioteca.",
    errorGetAll: "Erro ao buscar biblioteca.",
    errorCreate: "Erro ao adicionar livro à biblioteca.",
    errorUpdate: "Erro ao atualizar livro na biblioteca.",
    errorRemove: "Erro ao remover livro da biblioteca.",
  },
});

export const { getAll, update, updateManyStatus, setCover, registerAccess, remove, removeMany } = base;

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const parsed = bookCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos.", issues: parsed.error.flatten() });
      return;
    }
    const data = parsed.data as CreateBookLibraryEntry;
    if (!data.hardcoverId || !data.title) {
      res.status(400).json({ error: "hardcoverId e title são obrigatórios." });
      return;
    }

    const existing = await bookLibraryModel.findByExternalId(data.hardcoverId);
    if (existing) {
      res.status(409).json({ error: "Livro já está na biblioteca.", entry: existing });
      return;
    }

    const collection = await discoverBookSeries(data.hardcoverId);

    if (!collection) {
      const entry = await bookLibraryModel.create(data);
      res.status(201).json([entry]);
      return;
    }

    const { collectionId, members } = collection;
    const entries: CreateBookLibraryEntry[] = members.map((m) => ({
      hardcoverId: m.id,
      title: m.title,
      coverImage: m.coverImage,
      authors: m.authors.length > 0 ? m.authors.join(", ") : null,
      status: m.id === data.hardcoverId ? data.status ?? "plan_to_read" : "plan_to_read",
      score: m.id === data.hardcoverId ? data.score ?? 0 : 0,
      publishedDate: m.publishedDate,
      pageCount: m.pageCount,
      bookStatus: m.bookStatus,
      seriesName: m.seriesName,
      seriesPosition: m.seriesPosition,
    }));

    const group = await bulkUpsertBooks(entries, collectionId);
    group.sort((a, b) => (a.hardcoverId === data.hardcoverId ? -1 : b.hardcoverId === data.hardcoverId ? 1 : 0));
    res.status(201).json(group);
  } catch (error) {
    void notifyError("API POST /api/book-library", error);
    res.status(500).json({ error: "Erro ao adicionar livro à biblioteca." });
  }
}
