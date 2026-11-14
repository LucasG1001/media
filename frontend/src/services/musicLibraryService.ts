import { api } from "./api";
import type {
  MusicLibraryEntry,
  CreateMusicLibraryEntry,
  UpdateMusicLibraryEntry,
} from "../types/musicLibrary";

export async function fetchLibrary(): Promise<MusicLibraryEntry[]> {
  const response = await api.get<MusicLibraryEntry[]>("/api/music-library");
  return response.data;
}

export async function addToLibrary(entry: CreateMusicLibraryEntry): Promise<MusicLibraryEntry> {
  const response = await api.post<MusicLibraryEntry>("/api/music-library", entry);
  return response.data;
}

export interface MusicPlaylistImportResult {
  playlist: { name: string; imported: number; total: number };
}

export type AddMusicFromUrlResult = MusicLibraryEntry | MusicPlaylistImportResult;

export async function addFromUrl(url: string): Promise<AddMusicFromUrlResult> {
  const response = await api.post<AddMusicFromUrlResult>("/api/music-library/from-url", { url });
  return response.data;
}

export async function updateLibraryEntry(id: string, data: UpdateMusicLibraryEntry): Promise<MusicLibraryEntry> {
  const response = await api.put<MusicLibraryEntry>(`/api/music-library/${id}`, data);
  return response.data;
}

export async function registerAccess(id: string): Promise<MusicLibraryEntry> {
  const response = await api.post<MusicLibraryEntry>(`/api/music-library/${id}/access`);
  return response.data;
}

export async function removeFromLibrary(id: string): Promise<void> {
  await api.delete(`/api/music-library/${id}`);
}

export async function removeManyFromLibrary(ids: string[]): Promise<void> {
  await api.post("/api/music-library/bulk-delete", { ids });
}

export async function updateManyStatus(ids: string[], status: string): Promise<MusicLibraryEntry[]> {
  const response = await api.post<{ entries: MusicLibraryEntry[] }>("/api/music-library/bulk-update-status", { ids, status });
  return response.data.entries;
}
