import { TIER_ROW_ORDER, type TierRowId } from "./tierList";

export interface TierStyle {
  label: string;
  color: string;
  textColor: string;
}

export interface TierStyleBase {
  label: string;
  color: string;
}

export type TierOverrides = Partial<Record<TierRowId, Partial<TierStyleBase>>>;

export const DEFAULT_TIER_LABELS: Record<TierRowId, string> = {
  top: "Muito Bom",
  good: "Bom",
  mid: "Mediano",
  low: "Dá pra ver",
  bottom: "Eu gosto de sofrer",
  dropped: "Dropado",
  unrated: "Sem nota",
};

// As cores padrão são tokens do tema; viram hex em runtime (ver utils/cssVar.ts)
// porque o seletor de cor e o canvas da exportação só aceitam valor literal.
export const TIER_COLOR_TOKENS: Record<TierRowId, string> = {
  top: "--color-chip-8",
  good: "--color-chip-4",
  mid: "--color-chip-7",
  low: "--color-chip-3",
  bottom: "--color-text-primary",
  dropped: "--color-chip-2",
  unrated: "--color-surface",
};

// "Sem nota" é a bandeja do que falta avaliar, não uma faixa: fica fora da edição.
export const EDITABLE_TIER_ROWS: readonly TierRowId[] = TIER_ROW_ORDER.filter((id) => id !== "unrated");

export const TIER_LABEL_MAX = 30;

const HEX = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

// Luminância relativa (WCAG). 0,179 é o ponto em que texto escuro passa a dar
// mais contraste que texto claro. Cor que não é hex conta como escura: o texto
// claro é o padrão do tema.
export function isLightColor(color: string): boolean {
  if (!isHexColor(color)) return false;
  const channel = (offset: number) => {
    const value = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.179;
}

// O que vem do localStorage é dado não confiável: chave desconhecida, rótulo
// vazio e cor malformada são descartados em vez de quebrar a página.
export function parseTierOverrides(raw: string | null): TierOverrides {
  if (!raw) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!data || typeof data !== "object") return {};

  const source = data as Record<string, unknown>;
  const overrides: TierOverrides = {};
  for (const id of EDITABLE_TIER_ROWS) {
    const entry = source[id];
    if (!entry || typeof entry !== "object") continue;
    const { label, color } = entry as { label?: unknown; color?: unknown };
    const clean: Partial<TierStyleBase> = {};
    if (typeof label === "string" && label.trim()) clean.label = label.trim().slice(0, TIER_LABEL_MAX);
    if (isHexColor(color)) clean.color = color.toLowerCase();
    if (clean.label !== undefined || clean.color !== undefined) overrides[id] = clean;
  }
  return overrides;
}

export function resolveTierStyles(
  defaults: Record<TierRowId, TierStyleBase>,
  overrides: TierOverrides,
  text: { onLight: string; onDark: string }
): Record<TierRowId, TierStyle> {
  const styles = {} as Record<TierRowId, TierStyle>;
  for (const id of TIER_ROW_ORDER) {
    const label = overrides[id]?.label ?? defaults[id].label;
    const color = overrides[id]?.color ?? defaults[id].color;
    styles[id] = { label, color, textColor: isLightColor(color) ? text.onLight : text.onDark };
  }
  return styles;
}

// Só guarda o que difere do padrão: assim uma mudança futura nos padrões chega a
// quem nunca editou aquela faixa.
export function diffTierOverrides(
  defaults: Record<TierRowId, TierStyleBase>,
  edited: Partial<Record<TierRowId, TierStyleBase>>
): TierOverrides {
  const overrides: TierOverrides = {};
  for (const id of EDITABLE_TIER_ROWS) {
    const value = edited[id];
    if (!value) continue;
    const clean: Partial<TierStyleBase> = {};
    const label = value.label.trim().slice(0, TIER_LABEL_MAX);
    if (label && label !== defaults[id].label) clean.label = label;
    if (isHexColor(value.color) && value.color.toLowerCase() !== defaults[id].color.toLowerCase()) {
      clean.color = value.color.toLowerCase();
    }
    if (clean.label !== undefined || clean.color !== undefined) overrides[id] = clean;
  }
  return overrides;
}
