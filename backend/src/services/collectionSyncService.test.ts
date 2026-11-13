import { describe, it, expect, vi } from "vitest";

vi.mock("../database/connection.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("./notifyService.js", () => ({ notifyNewCollectionItem: vi.fn(), notifyError: vi.fn() }));

const { selectSeeds } = await import("./collectionSyncService.js");

interface Entry {
  id: number;
  collection: number | null;
  completed: boolean;
  missing?: boolean;
}

const adapter = {
  externalId: (entry: Entry) => entry.id,
  collectionKey: (entry: Entry) => entry.collection,
  isCompleted: (entry: Entry) => entry.completed,
  isMissing: (entry: Entry) => entry.missing === true,
};

describe("selectSeeds", () => {
  it("seeds one member per collection that has a completed item", () => {
    const seeds = selectSeeds(adapter, [
      { id: 1, collection: 10, completed: false },
      { id: 2, collection: 10, completed: true },
      { id: 3, collection: 20, completed: false },
    ]);
    expect([...seeds]).toEqual([1]);
  });

  it("seeds completed items that have no collection yet", () => {
    const seeds = selectSeeds(adapter, [
      { id: 1, collection: null, completed: true },
      { id: 2, collection: null, completed: false },
    ]);
    expect([...seeds]).toEqual([1]);
  });

  it("skips an item removed from the external API and seeds its sibling instead", () => {
    const seeds = selectSeeds(adapter, [
      { id: 1127274, collection: 1136366, completed: false, missing: true },
      { id: 980431, collection: 1136366, completed: true },
    ]);
    expect([...seeds]).toEqual([980431]);
  });

  it("never seeds a removed item, even when it is the only completed one", () => {
    const seeds = selectSeeds(adapter, [{ id: 5, collection: null, completed: true, missing: true }]);
    expect(seeds.size).toBe(0);
  });
});
