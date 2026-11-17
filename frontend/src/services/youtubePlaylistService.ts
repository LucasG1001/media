import { api } from "./api";
import type { YoutubeKind, YoutubePlaylist } from "../types/youtubeLibrary";

const BASE = "/api/youtube-library/playlists";

export async function fetchPlaylists(): Promise<YoutubePlaylist[]> {
  const response = await api.get<YoutubePlaylist[]>(BASE);
  return response.data;
}

export async function createPlaylist(name: string, kind: YoutubeKind, entryIds: string[]): Promise<YoutubePlaylist> {
  const response = await api.post<YoutubePlaylist>(BASE, { name, kind, entryIds });
  return response.data;
}

export async function renamePlaylist(id: string, name: string): Promise<YoutubePlaylist> {
  const response = await api.put<YoutubePlaylist>(`${BASE}/${id}`, { name });
  return response.data;
}

export async function deletePlaylist(id: string): Promise<void> {
  await api.delete(`${BASE}/${id}`);
}

export async function addPlaylistItems(id: string, entryIds: string[]): Promise<YoutubePlaylist> {
  const response = await api.post<YoutubePlaylist>(`${BASE}/${id}/items`, { entryIds });
  return response.data;
}

export async function removePlaylistItems(id: string, entryIds: string[]): Promise<YoutubePlaylist> {
  const response = await api.post<YoutubePlaylist>(`${BASE}/${id}/items/remove`, { entryIds });
  return response.data;
}
