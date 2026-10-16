import { api } from "./api";
import type { MovieLibraryEntry, CreateMovieLibraryEntry, UpdateMovieLibraryEntry } from "../types/movieLibrary";

export async function fetchLibrary(): Promise<MovieLibraryEntry[]> {
  const response = await api.get<MovieLibraryEntry[]>("/api/movie-library");
  return response.data;
}

export async function addToLibrary(entry: CreateMovieLibraryEntry): Promise<MovieLibraryEntry[]> {
  const response = await api.post<MovieLibraryEntry[]>("/api/movie-library", entry);
  return response.data;
}

export async function updateLibraryEntry(id: string, data: UpdateMovieLibraryEntry): Promise<MovieLibraryEntry> {
  const response = await api.put<MovieLibraryEntry>(`/api/movie-library/${id}`, data);
  return response.data;
}

export async function setCover(id: string): Promise<MovieLibraryEntry> {
  const response = await api.put<MovieLibraryEntry>(`/api/movie-library/${id}/cover`);
  return response.data;
}

export async function removeFromLibrary(id: string): Promise<void> {
  await api.delete(`/api/movie-library/${id}`);
}

export async function removeManyFromLibrary(ids: string[]): Promise<void> {
  await api.post("/api/movie-library/bulk-delete", { ids });
}

export async function updateManyStatus(ids: string[], status: string): Promise<MovieLibraryEntry[]> {
  const response = await api.post<{ entries: MovieLibraryEntry[] }>("/api/movie-library/bulk-update-status", { ids, status });
  return response.data.entries;
}
