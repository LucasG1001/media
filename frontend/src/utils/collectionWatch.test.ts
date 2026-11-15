import { describe, it, expect } from "vitest";
import { findGroupOf, pickWatchEntry } from "./collectionWatch";

// Uma coleção de três e um avulso.
const GROUPS = [
  { key: "saga", members: [{ id: "a" }, { id: "b" }, { id: "c" }] },
  { key: "avulso", members: [{ id: "z" }] },
];

describe("findGroupOf", () => {
  it("acha a coleção do item, inclusive a de um item só", () => {
    expect(findGroupOf(GROUPS, "b")?.key).toBe("saga");
    expect(findGroupOf(GROUPS, "z")?.key).toBe("avulso");
  });

  it("não acha item que não está em nenhuma coleção da tela", () => {
    expect(findGroupOf(GROUPS, "x")).toBeUndefined();
  });
});

describe("pickWatchEntry", () => {
  it("sem escolha, abre o primeiro item da primeira coleção", () => {
    expect(pickWatchEntry(GROUPS, null)).toBe(GROUPS[0].members[0]);
  });

  it("abre o item escolhido", () => {
    expect(pickWatchEntry(GROUPS, "z")?.id).toBe("z");
    expect(pickWatchEntry(GROUPS, "b")?.id).toBe("b");
  });

  // O filtro pode tirar a coleção do escolhido de vista: a tela não fica órfã.
  it("cai no primeiro da lista quando o escolhido saiu de vista", () => {
    const withoutSingle = GROUPS.filter((group) => group.key !== "avulso");
    expect(pickWatchEntry(withoutSingle, "z")).toBe(withoutSingle[0].members[0]);
  });

  it("não tem o que abrir com a lista vazia", () => {
    expect(pickWatchEntry([], null)).toBeUndefined();
    expect(pickWatchEntry([], "b")).toBeUndefined();
  });
});
