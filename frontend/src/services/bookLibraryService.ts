import { api } from "./api";
import type { BookLibraryEntry, CreateBookLibraryEntry, UpdateBookLibraryEntry } from "../types/bookLibrary";

export async function fetchLibrary(): Promise<BookLibraryEntry[]> {
  const response = await api.get<BookLibraryEntry[]>("/api/book-library");
  return response.data;
}

export async function addToLibrary(entry: CreateBookLibraryEntry): Promise<BookLibraryEntry[]> {
  const response = await api.post<BookLibraryEntry[]>("/api/book-library", entry);
  return response.data;
}

export async function updateLibraryEntry(id: string, data: UpdateBookLibraryEntry): Promise<BookLibraryEntry> {
  const response = await api.put<BookLibraryEntry>(`/api/book-library/${id}`, data);
  return response.data;
}

export async function setCover(id: string): Promise<BookLibraryEntry> {
  const response = await api.put<BookLibraryEntry>(`/api/book-library/${id}/cover`);
  return response.data;
}

export async function removeFromLibrary(id: string): Promise<void> {
  await api.delete(`/api/book-library/${id}`);
}

export async function removeManyFromLibrary(ids: string[]): Promise<void> {
  await api.post("/api/book-library/bulk-delete", { ids });
}

export async function updateManyStatus(ids: string[], status: string): Promise<BookLibraryEntry[]> {
  const response = await api.post<{ entries: BookLibraryEntry[] }>("/api/book-library/bulk-update-status", { ids, status });
  return response.data.entries;
}
