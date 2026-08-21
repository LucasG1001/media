import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import type { ReadStream } from "node:fs";
import { mkdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { httpRequestFull } from "./httpClient.js";

const DEFAULT_DIR = path.resolve(process.cwd(), ".cache/images");
const MAX_BYTES = 10 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 20000;

// /api/img recebe a URL do cliente: sem allowlist o backend viraria um proxy
// aberto para qualquer endereço alcançável da VPS (inclusive a rede interna do
// compose). IMAGE_EXTRA_HOSTS amplia a lista sem exigir deploy de código.
const ALLOWED_HOST_SUFFIXES = [
  "anilist.co",
  "image.tmdb.org",
  "images.igdb.com",
  "hardcover.app",
  "ytimg.com",
  "ggpht.com",
  "googleusercontent.com",
  "crunchyroll.com",
];

export interface DownloadedImage {
  buffer: Buffer;
  contentType: string;
}

export function imageCacheDir(): string {
  return process.env.IMAGE_CACHE_DIR || DEFAULT_DIR;
}

export function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

export function imagePath(hash: string): string {
  return path.join(imageCacheDir(), hash.slice(0, 2), hash);
}

function allowedSuffixes(): string[] {
  const extra = (process.env.IMAGE_EXTRA_HOSTS || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return [...ALLOWED_HOST_SUFFIXES, ...extra];
}

export function isAllowedImageUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  if (parsed.port) return false;
  const host = parsed.hostname.toLowerCase();
  return allowedSuffixes().some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

export async function statCached(hash: string): Promise<number | null> {
  try {
    const info = await stat(imagePath(hash));
    return info.isFile() ? info.size : null;
  } catch {
    return null;
  }
}

export async function downloadImage(url: string): Promise<DownloadedImage> {
  const response = await httpRequestFull<ArrayBuffer>({
    url,
    method: "get",
    responseType: "arraybuffer",
    timeout: DOWNLOAD_TIMEOUT_MS,
    maxRedirects: 2,
  });
  const contentType = String(response.headers["content-type"] ?? "");
  if (!contentType.startsWith("image/")) {
    throw new Error(`Resposta não é imagem (${contentType || "sem content-type"}).`);
  }
  const buffer = Buffer.from(response.data);
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error(`Imagem acima do limite de ${MAX_BYTES} bytes.`);
  }
  return { buffer, contentType };
}

export async function storeImage(hash: string, buffer: Buffer): Promise<void> {
  const target = imagePath(hash);
  await mkdir(path.dirname(target), { recursive: true });
  // Grava em temporário e renomeia: o rename é atômico, então uma requisição
  // concorrente nunca abre um arquivo pela metade.
  const temp = `${target}.${process.pid}.tmp`;
  await writeFile(temp, buffer);
  await rename(temp, target);
}

export async function removeImage(hash: string): Promise<void> {
  try {
    await unlink(imagePath(hash));
  } catch {
    return;
  }
}

export function openImage(hash: string): ReadStream {
  return createReadStream(imagePath(hash));
}
