import { api } from "./api";
import type { SeriesListResponse, SeriesDetail, SeasonDetail } from "../types/series";

export async function fetchPopular(year?: number, month?: number, page = 1, signal?: AbortSignal): Promise<SeriesListResponse> {
  const params: Record<string, number> = { page };
  if (year) params.year = year;
  if (month) params.month = month;
  const response = await api.get<SeriesListResponse>("/api/series/popular", { params, signal });
  return response.data;
}

export async function searchSeries(query: string, page = 1, signal?: AbortSignal): Promise<SeriesListResponse> {
  const response = await api.get<SeriesListResponse>("/api/series/search", { params: { q: query, page }, signal });
  return response.data;
}

export async function fetchSeriesById(id: number): Promise<SeriesDetail> {
  const response = await api.get<SeriesDetail>(`/api/series/${id}`);
  return response.data;
}

export async function fetchSeasonById(seriesId: number, seasonNumber: number): Promise<SeasonDetail> {
  const response = await api.get<SeasonDetail>(`/api/series/${seriesId}/season/${seasonNumber}`);
  return response.data;
}
