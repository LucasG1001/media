import { proxied } from "./imageUrl";

export interface TierImageTile {
  title: string;
  cover: string | null;
}

export interface TierImageRow {
  label: string;
  color: string;
  textColor: string;
  tiles: TierImageTile[];
}

export interface TierImageTheme {
  background: string;
  surface: string;
  placeholder: string;
  text: string;
  muted: string;
  fontFamily: string;
}

export interface TierImageInput {
  title: string;
  subtitle: string;
  rows: TierImageRow[];
  theme: TierImageTheme;
}

export interface TierImageMetrics {
  width: number;
  headerHeight: number;
  labelWidth: number;
  tileWidth: number;
  tileHeight: number;
  rowGap: number;
}

export const TIER_IMAGE_METRICS: TierImageMetrics = {
  width: 1600,
  headerHeight: 88,
  labelWidth: 200,
  tileWidth: 100,
  tileHeight: 140,
  rowGap: 4,
};

export interface TierImageRowLayout {
  y: number;
  height: number;
  tiles: { x: number; y: number }[];
}

export interface TierImageLayout {
  width: number;
  height: number;
  perLine: number;
  rows: TierImageRowLayout[];
}

// Geometria separada do desenho para ser testável sem canvas. Faixa vazia ocupa
// uma linha, como no tier list clássico.
export function layoutTierImage(
  tileCounts: readonly number[],
  metrics: TierImageMetrics = TIER_IMAGE_METRICS
): TierImageLayout {
  const { width, headerHeight, labelWidth, tileWidth, tileHeight, rowGap } = metrics;
  const perLine = Math.max(1, Math.floor((width - labelWidth) / tileWidth));

  let y = headerHeight;
  const rows = tileCounts.map((count, rowIndex) => {
    if (rowIndex > 0) y += rowGap;
    const lines = Math.max(1, Math.ceil(count / perLine));
    const top = y;
    const tiles = Array.from({ length: count }, (_, i) => ({
      x: labelWidth + (i % perLine) * tileWidth,
      y: top + Math.floor(i / perLine) * tileHeight,
    }));
    y += lines * tileHeight;
    return { y: top, height: lines * tileHeight, tiles };
  });

  return { width, height: y, perLine, rows };
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

const LOAD_CONCURRENCY = 8;

// Capa que falha vira null e o desenho cai no placeholder com o título: uma
// imagem ruim não pode derrubar a exportação inteira.
async function loadCovers(urls: readonly (string | null)[]): Promise<(HTMLImageElement | null)[]> {
  const images: (HTMLImageElement | null)[] = new Array(urls.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const index = next++;
      const url = proxied(urls[index]);
      if (url) images[index] = await loadImage(url);
    }
  };
  await Promise.all(Array.from({ length: Math.min(LOAD_CONCURRENCY, urls.length) }, worker));
  return images;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.map((line) => {
    let fitted = line;
    while (fitted.length > 1 && ctx.measureText(fitted).width > maxWidth) fitted = fitted.slice(0, -1);
    return fitted;
  });
}

function drawCentered(
  ctx: CanvasRenderingContext2D,
  lines: readonly string[],
  centerX: number,
  centerY: number,
  lineHeight: number
): void {
  const first = centerY - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, centerX, first + i * lineHeight));
}

// Equivalente a object-fit: cover.
function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  ctx.drawImage(
    image,
    (image.naturalWidth - sourceWidth) / 2,
    (image.naturalHeight - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height
  );
}

// As capas passam por /api/img (mesma origem), então o canvas não fica "tainted"
// e o toBlob funciona — com a URL crua da CDN ele lançaria SecurityError.
export async function renderTierListImage(input: TierImageInput): Promise<Blob> {
  const metrics = TIER_IMAGE_METRICS;
  const { rows, theme } = input;
  const layout = layoutTierImage(rows.map((row) => row.tiles.length), metrics);

  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível.");

  const covers = await loadCovers(rows.flatMap((row) => row.tiles.map((tile) => tile.cover)));

  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, layout.width, layout.height);

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = theme.text;
  ctx.font = `700 34px ${theme.fontFamily}`;
  ctx.fillText(input.title, 24, metrics.headerHeight / 2);
  ctx.textAlign = "right";
  ctx.fillStyle = theme.muted;
  ctx.font = `500 22px ${theme.fontFamily}`;
  ctx.fillText(input.subtitle, layout.width - 24, metrics.headerHeight / 2);

  let coverIndex = 0;
  rows.forEach((row, rowIndex) => {
    const box = layout.rows[rowIndex];

    ctx.fillStyle = theme.surface;
    ctx.fillRect(metrics.labelWidth, box.y, layout.width - metrics.labelWidth, box.height);

    ctx.fillStyle = row.color;
    ctx.fillRect(0, box.y, metrics.labelWidth, box.height);
    ctx.fillStyle = row.textColor;
    ctx.textAlign = "center";
    ctx.font = `600 24px ${theme.fontFamily}`;
    drawCentered(
      ctx,
      wrapText(ctx, row.label, metrics.labelWidth - 24, 4),
      metrics.labelWidth / 2,
      box.y + box.height / 2,
      30
    );

    row.tiles.forEach((tile, tileIndex) => {
      const { x, y } = box.tiles[tileIndex];
      const image = covers[coverIndex++];
      if (image && image.naturalWidth > 0) {
        drawCover(ctx, image, x, y, metrics.tileWidth, metrics.tileHeight);
        return;
      }
      ctx.fillStyle = theme.placeholder;
      ctx.fillRect(x + 1, y + 1, metrics.tileWidth - 2, metrics.tileHeight - 2);
      ctx.fillStyle = theme.text;
      ctx.font = `500 13px ${theme.fontFamily}`;
      drawCentered(
        ctx,
        wrapText(ctx, tile.title, metrics.tileWidth - 12, 6),
        x + metrics.tileWidth / 2,
        y + metrics.tileHeight / 2,
        16
      );
    });
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar o PNG."))), "image/png");
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revogar na hora cancela o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
