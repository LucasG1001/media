import axios from "axios";
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { cacheGet, cacheSet } from "./cache.js";
import type { RateLimiter } from "./rateLimiter.js";

const DEFAULT_TIMEOUT_MS = 10000;
const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 300;

export interface RequestOptions {
  limiter?: RateLimiter;
  maxRetries?: number;
}

function isRetriable(error: unknown): boolean {
  const axiosError = error as AxiosError;
  if (!axiosError.response) return true;
  const status = axiosError.response.status;
  return status === 429 || status >= 500;
}

function retryDelayMs(error: unknown, attempt: number): number {
  const axiosError = error as AxiosError;
  const header = axiosError.response?.headers?.["retry-after"] as string | undefined;
  if (header) {
    const seconds = Number(header);
    if (!Number.isNaN(seconds)) return seconds * 1000;
  }
  return BASE_BACKOFF_MS * 2 ** attempt;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function httpRequest<T>(config: AxiosRequestConfig, options?: RequestOptions): Promise<T> {
  const response = await httpRequestFull<T>(config, options);
  return response.data;
}

export async function httpRequestFull<T>(
  config: AxiosRequestConfig,
  options?: RequestOptions
): Promise<AxiosResponse<T>> {
  const limiter = options?.limiter;
  const maxRetries = options?.maxRetries ?? MAX_RETRIES;
  let attempt = 0;
  for (;;) {
    try {
      if (limiter) await limiter.acquire();
      const response = await axios.request<T>({ timeout: DEFAULT_TIMEOUT_MS, ...config });
      limiter?.observe(response.headers as Record<string, unknown>);
      return response;
    } catch (error) {
      if (attempt >= maxRetries || !isRetriable(error)) throw error;
      const wait = retryDelayMs(error, attempt);
      const status = (error as AxiosError).response?.status;
      if (limiter && status === 429) limiter.note429(wait);
      await delay(wait);
      attempt++;
    }
  }
}

function cacheKey(config: AxiosRequestConfig): string {
  return JSON.stringify({
    method: config.method ?? "get",
    url: config.url ?? "",
    params: config.params ?? null,
    data: config.data ?? null,
  });
}

export async function cachedRequest<T>(config: AxiosRequestConfig, ttlMs: number, options?: RequestOptions): Promise<T> {
  const key = cacheKey(config);
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;
  const data = await httpRequest<T>(config, options);
  cacheSet(key, data, ttlMs);
  return data;
}
