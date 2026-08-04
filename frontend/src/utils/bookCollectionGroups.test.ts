import { describe, it, expect } from "vitest";
import { buildBookCollectionGroups } from "./bookCollectionGroups";
import type { BookLibraryEntry } from "../types/bookLibrary";

let seq = 0;

function entry(over: Partial<BookLibraryEntry> = {}): BookLibraryEntry {
  seq += 1;
  return {
    id: `uuid-${seq}`,
    hardcoverId: seq,
    title: `Livro ${seq}`,
    coverImage: null,
    authors: null,
    status: "plan_to_read",
    score: 0,
    publishedDate: null,
    pageCount: null,
    bookStatus: "RELEASED",
    collectionId: null,
    seriesName: null,
    seriesPosition: null,
    isCover: false,
    syncedAt: null,
    notes: null,
    readAt: null,
    lastAccessAt: null,
    releaseNotifiedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("buildBookCollectionGroups", () => {
  it("ordena a expansão pela posição na série, incluindo meio-valor", () => {
    const entries = [
      entry({ title: "Hero of Ages", collectionId: 10, seriesPosition: 3 }),
      entry({ title: "Secret History", collectionId: 10, seriesPosition: 3.5 }),
      entry({ title: "Final Empire", collectionId: 10, seriesPosition: 1 }),
      entry({ title: "Eleventh Metal", collectionId: 10, seriesPosition: 0.5 }),
      entry({ title: "Well of Ascension", collectionId: 10, seriesPosition: 2 }),
    ];
    const [group] = buildBookCollectionGroups(entries);
    expect(group.members.map((m) => m.seriesPosition)).toEqual([0.5, 1, 2, 3, 3.5]);
  });

  // A posição manda mesmo quando contraria a data: "Ballad of Songbirds" é posição 0 na
  // ordem de leitura e o mais recente em publicação.
  it("a posição vence a data de publicação", () => {
    const entries = [
      entry({ title: "Hunger Games", collectionId: 20, seriesPosition: 1, publishedDate: "2008-09-14" }),
      entry({ title: "Ballad of Songbirds", collectionId: 20, seriesPosition: 0, publishedDate: "2020-01-01" }),
    ];
    const [group] = buildBookCollectionGroups(entries);
    expect(group.members.map((m) => m.title)).toEqual(["Ballad of Songbirds", "Hunger Games"]);
  });

  it("posição nula vai para o fim", () => {
    const entries = [
      entry({ title: "Sem posição", collectionId: 30, seriesPosition: null }),
      entry({ title: "Primeiro", collectionId: 30, seriesPosition: 1 }),
    ];
    const [group] = buildBookCollectionGroups(entries);
    expect(group.members.map((m) => m.title)).toEqual(["Primeiro", "Sem posição"]);
  });

  it("agrupa por coleção e deixa livro sem coleção avulso", () => {
    const entries = [
      entry({ collectionId: 40, seriesPosition: 1 }),
      entry({ collectionId: 40, seriesPosition: 2 }),
      entry({ collectionId: null }),
    ];
    const groups = buildBookCollectionGroups(entries);
    expect(groups).toHaveLength(2);
    const collection = groups.find((g) => g.key === "collection-40");
    expect(collection?.count).toBe(2);
    expect(groups.some((g) => g.key.startsWith("single-"))).toBe(true);
  });

  // O denominador do badge é sempre o total da coleção; o filtro só reduz o que aparece.
  it("o filtro reduz members mas não o count", () => {
    const entries = [
      entry({ collectionId: 50, seriesPosition: 1, status: "read" }),
      entry({ collectionId: 50, seriesPosition: 2, status: "plan_to_read" }),
      entry({ collectionId: 50, seriesPosition: 3, status: "plan_to_read" }),
    ];
    const [group] = buildBookCollectionGroups(entries, (m) => m.status === "plan_to_read");
    expect(group.count).toBe(3);
    expect(group.completedCount).toBe(2);
    expect(group.members).toHaveLength(2);
  });

  it("coleção sem nenhum membro casando desaparece", () => {
    const entries = [entry({ collectionId: 60, seriesPosition: 1, status: "read" })];
    expect(buildBookCollectionGroups(entries, (m) => m.status === "dropped")).toHaveLength(0);
  });
});
