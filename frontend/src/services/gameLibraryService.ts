import { api } from "./api";
import type { GameLibraryEntry, CreateGameLibraryEntry, UpdateGameLibraryEntry } from "../types/gameLibrary";

export async function fetchLibrary(): Promise<GameLibraryEntry[]> {
  const response = await api.get<GameLibraryEntry[]>("/api/game-library");
  return response.data;
}

export async function addToLibrary(entry: CreateGameLibraryEntry): Promise<GameLibraryEntry[]> {
  const response = await api.post<GameLibraryEntry[]>("/api/game-library", entry);
  return response.data;
}

export async function updateLibraryEntry(id: string, data: UpdateGameLibraryEntry): Promise<GameLibraryEntry> {
  const response = await api.put<GameLibraryEntry>(`/api/game-library/${id}`, data);
  return response.data;
}

export async function setCover(id: string): Promise<GameLibraryEntry> {
  const response = await api.put<GameLibraryEntry>(`/api/game-library/${id}/cover`);
  return response.data;
}

export async function removeFromLibrary(id: string): Promise<void> {
  await api.delete(`/api/game-library/${id}`);
}

export async function removeManyFromLibrary(ids: string[]): Promise<void> {
  await api.post("/api/game-library/bulk-delete", { ids });
}

export async function updateManyStatus(ids: string[], status: string): Promise<GameLibraryEntry[]> {
  const response = await api.post<{ entries: GameLibraryEntry[] }>("/api/game-library/bulk-update-status", { ids, status });
  return response.data.entries;
}
