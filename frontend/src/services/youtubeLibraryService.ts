import { api } from "./api";
import type {
  YoutubeLibraryEntry,
  CreateYoutubeLibraryEntry,
  UpdateYoutubeLibraryEntry,
  YoutubeCollection,
} from "../types/youtubeLibrary";

export async function fetchLibrary(): Promise<YoutubeLibraryEntry[]> {
  const response = await api.get<YoutubeLibraryEntry[]>("/api/youtube-library");
  return response.data;
}

export async function addToLibrary(entry: CreateYoutubeLibraryEntry): Promise<YoutubeLibraryEntry> {
  const response = await api.post<YoutubeLibraryEntry>("/api/youtube-library", entry);
  return response.data;
}

export interface PlaylistImportResult {
  playlist: { name: string; imported: number; collectionId: number };
}

export type AddFromUrlResult = YoutubeLibraryEntry | PlaylistImportResult;

export async function addFromUrl(url: string): Promise<AddFromUrlResult> {
  const response = await api.post<AddFromUrlResult>("/api/youtube-library/from-url", { url });
  return response.data;
}

export async function updateLibraryEntry(id: string, data: UpdateYoutubeLibraryEntry): Promise<YoutubeLibraryEntry> {
  const response = await api.put<YoutubeLibraryEntry>(`/api/youtube-library/${id}`, data);
  return response.data;
}

export async function registerAccess(id: string): Promise<YoutubeLibraryEntry> {
  const response = await api.post<YoutubeLibraryEntry>(`/api/youtube-library/${id}/access`);
  return response.data;
}

export async function setCover(id: string): Promise<YoutubeLibraryEntry> {
  const response = await api.put<YoutubeLibraryEntry>(`/api/youtube-library/${id}/cover`);
  return response.data;
}

export async function removeFromLibrary(id: string): Promise<void> {
  await api.delete(`/api/youtube-library/${id}`);
}

export async function removeManyFromLibrary(ids: string[]): Promise<void> {
  await api.post("/api/youtube-library/bulk-delete", { ids });
}

export async function updateManyStatus(ids: string[], status: string): Promise<YoutubeLibraryEntry[]> {
  const response = await api.post<{ entries: YoutubeLibraryEntry[] }>("/api/youtube-library/bulk-update-status", { ids, status });
  return response.data.entries;
}

export async function addTagMany(ids: string[], tag: string): Promise<void> {
  await api.post("/api/youtube-library/bulk-add-tag", { ids, tag });
}

export async function removeTagMany(ids: string[], tag: string): Promise<void> {
  await api.post("/api/youtube-library/bulk-remove-tag", { ids, tag });
}

export async function listCollections(): Promise<YoutubeCollection[]> {
  const response = await api.get<YoutubeCollection[]>("/api/youtube-library/collections");
  return response.data;
}

export async function formGroup(ids: string[], name: string): Promise<YoutubeCollection> {
  const response = await api.post<{ collection: YoutubeCollection }>("/api/youtube-library/collections", { ids, name });
  return response.data.collection;
}

export async function addToGroup(ids: string[], collectionId: number): Promise<void> {
  await api.post("/api/youtube-library/collections/add", { ids, collectionId });
}

export async function removeFromGroup(ids: string[]): Promise<void> {
  await api.post("/api/youtube-library/collections/remove", { ids });
}

export async function renameCollection(id: number, name: string): Promise<YoutubeCollection> {
  const response = await api.put<{ collection: YoutubeCollection }>(`/api/youtube-library/collections/${id}`, { name });
  return response.data.collection;
}
