import { api } from "./api";
import type {
  YoutubeLibraryEntry,
  YoutubeKind,
  CreateYoutubeLibraryEntry,
  UpdateYoutubeLibraryEntry,
} from "../types/youtubeLibrary";

export async function fetchLibrary(): Promise<YoutubeLibraryEntry[]> {
  const response = await api.get<YoutubeLibraryEntry[]>("/api/youtube-library");
  return response.data;
}

export async function addToLibrary(entry: CreateYoutubeLibraryEntry): Promise<YoutubeLibraryEntry> {
  const response = await api.post<YoutubeLibraryEntry>("/api/youtube-library", entry);
  return response.data;
}

// `videoIds`: todos os itens da playlist do YouTube, na ordem dela — inclusive
// os que já estavam na biblioteca.
export interface PlaylistImportResult {
  playlist: { name: string; imported: number; total: number; videoIds: string[] };
}

export type AddFromUrlResult = YoutubeLibraryEntry | PlaylistImportResult;

export async function addFromUrl(url: string, kind: YoutubeKind): Promise<AddFromUrlResult> {
  const response = await api.post<AddFromUrlResult>("/api/youtube-library/from-url", { url, kind });
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
