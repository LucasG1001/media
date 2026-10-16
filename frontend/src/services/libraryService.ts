import { api } from "./api";
import type { LibraryEntry, CreateLibraryEntry, UpdateLibraryEntry } from "../types/library";

export async function fetchLibrary(): Promise<LibraryEntry[]> {
  const response = await api.get<LibraryEntry[]>("/api/library");
  return response.data;
}

export async function addToLibrary(entry: CreateLibraryEntry): Promise<LibraryEntry[]> {
  const response = await api.post<LibraryEntry[]>("/api/library", entry);
  return response.data;
}

export async function updateLibraryEntry(id: string, data: UpdateLibraryEntry): Promise<LibraryEntry> {
  const response = await api.put<LibraryEntry>(`/api/library/${id}`, data);
  return response.data;
}

export async function setCover(id: string): Promise<LibraryEntry> {
  const response = await api.put<LibraryEntry>(`/api/library/${id}/cover`);
  return response.data;
}

export async function removeFromLibrary(id: string): Promise<void> {
  await api.delete(`/api/library/${id}`);
}

export async function removeManyFromLibrary(ids: string[]): Promise<void> {
  await api.post("/api/library/bulk-delete", { ids });
}

export async function updateManyStatus(ids: string[], status: string): Promise<LibraryEntry[]> {
  const response = await api.post<{ entries: LibraryEntry[] }>("/api/library/bulk-update-status", { ids, status });
  return response.data.entries;
}
