import type { Request, Response } from "express";
import { fetchBooksByGenre, searchBooks, fetchBookById } from "../services/hardcoverService.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const getByGenre = asyncHandler("API book/list", "Erro ao buscar livros.", async (req: Request, res: Response) => {
  const genre = String(req.query.genre || "Fiction");
  const page = parseInt(String(req.query.page || "1")) || 1;
  res.json(await fetchBooksByGenre(genre, page));
});

export const search = asyncHandler("API book/list", "Erro ao buscar livros.", async (req: Request, res: Response) => {
  const query = String(req.query.q || "");
  if (!query) {
    res.status(400).json({ error: "Parâmetro de busca é obrigatório." });
    return;
  }
  const page = parseInt(String(req.query.page || "1")) || 1;
  res.json(await searchBooks(query, page));
});

export const getById = asyncHandler("API book/:id", "Erro ao buscar detalhes do livro.", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }
  res.json(await fetchBookById(id));
});
