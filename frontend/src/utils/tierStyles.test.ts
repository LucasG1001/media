import { describe, it, expect } from "vitest";
import {
  DEFAULT_TIER_LABELS,
  diffTierOverrides,
  isLightColor,
  parseTierOverrides,
  resolveTierStyles,
  type TierStyleBase,
} from "./tierStyles";
import { TIER_ROW_ORDER, type TierRowId } from "./tierList";

const defaults = Object.fromEntries(
  TIER_ROW_ORDER.map((id) => [id, { label: DEFAULT_TIER_LABELS[id], color: "#fb923c" }])
) as Record<TierRowId, TierStyleBase>;

const text = { onLight: "#000000", onDark: "#ffffff" };

describe("isLightColor", () => {
  it("separates light backgrounds from dark ones", () => {
    expect(isLightColor("#ffffff")).toBe(true);
    expect(isLightColor("#fb923c")).toBe(true);
    expect(isLightColor("#000000")).toBe(false);
    expect(isLightColor("#1c1c2e")).toBe(false);
  });

  it("treats anything that is not a hex color as dark", () => {
    expect(isLightColor("rgb(255, 255, 255)")).toBe(false);
    expect(isLightColor("")).toBe(false);
  });
});

describe("parseTierOverrides", () => {
  it("returns nothing for missing or broken storage", () => {
    expect(parseTierOverrides(null)).toEqual({});
    expect(parseTierOverrides("{not json")).toEqual({});
    expect(parseTierOverrides("42")).toEqual({});
  });

  it("keeps valid entries and drops the invalid parts", () => {
    const raw = JSON.stringify({
      top: { label: "  Obra-prima  ", color: "#AABBCC" },
      good: { label: "", color: "red" },
      mid: { color: "#123456" },
      unknown: { label: "x" },
      unrated: { label: "Pendentes" },
    });

    expect(parseTierOverrides(raw)).toEqual({
      top: { label: "Obra-prima", color: "#aabbcc" },
      mid: { color: "#123456" },
    });
  });
});

describe("resolveTierStyles", () => {
  it("applies overrides over the defaults and picks a readable text color", () => {
    const styles = resolveTierStyles(defaults, { top: { label: "S", color: "#101010" } }, text);

    expect(styles.top).toEqual({ label: "S", color: "#101010", textColor: "#ffffff" });
    expect(styles.good).toEqual({ label: "Bom", color: "#fb923c", textColor: "#000000" });
  });
});

describe("diffTierOverrides", () => {
  it("stores only what differs from the defaults", () => {
    const edited: Partial<Record<TierRowId, TierStyleBase>> = {
      top: { label: "Muito Bom", color: "#FB923C" },
      good: { label: "Ótimo", color: "#fb923c" },
      mid: { label: "Mediano", color: "#000000" },
      low: { label: "   ", color: "#fb923c" },
    };

    expect(diffTierOverrides(defaults, edited)).toEqual({
      good: { label: "Ótimo" },
      mid: { color: "#000000" },
    });
  });
});
