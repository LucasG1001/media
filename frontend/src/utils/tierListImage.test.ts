import { describe, it, expect } from "vitest";
import { layoutTierImage, type TierImageMetrics } from "./tierListImage";

const metrics: TierImageMetrics = {
  width: 500,
  headerHeight: 50,
  labelWidth: 100,
  tileWidth: 100,
  tileHeight: 140,
  rowGap: 4,
};

describe("layoutTierImage", () => {
  it("fits as many tiles per line as the width allows", () => {
    expect(layoutTierImage([1], metrics).perLine).toBe(4);
  });

  it("keeps one line for an empty row", () => {
    const layout = layoutTierImage([0], metrics);
    expect(layout.rows[0]).toEqual({ y: 50, height: 140, tiles: [] });
    expect(layout.height).toBe(190);
  });

  it("wraps tiles onto new lines and grows the row", () => {
    const layout = layoutTierImage([6], metrics);
    const row = layout.rows[0];

    expect(row.height).toBe(280);
    expect(row.tiles[0]).toEqual({ x: 100, y: 50 });
    expect(row.tiles[3]).toEqual({ x: 400, y: 50 });
    expect(row.tiles[4]).toEqual({ x: 100, y: 190 });
    expect(row.tiles[5]).toEqual({ x: 200, y: 190 });
  });

  it("stacks rows with the gap between them", () => {
    const layout = layoutTierImage([2, 5, 0], metrics);

    expect(layout.rows.map((r) => r.y)).toEqual([50, 194, 478]);
    expect(layout.rows.map((r) => r.height)).toEqual([140, 280, 140]);
    expect(layout.height).toBe(618);
  });
});
