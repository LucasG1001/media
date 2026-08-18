import { describe, it, expect } from "vitest";
import { collectionNav } from "./collectionNav";

interface Item {
  id: string;
}

const group = (...ids: string[]) => ({ members: ids.map((id) => ({ id })) });
const is = (id: string) => (m: Item) => m.id === id;

describe("collectionNav", () => {
  it("acha os vizinhos dentro da coleção do item", () => {
    const nav = collectionNav([group("x"), group("a", "b", "c")], is("b"));
    expect(nav).toEqual({
      index: 1,
      total: 3,
      prev: { id: "a" },
      next: { id: "c" },
    });
  });

  it("na primeira posição não tem anterior", () => {
    const nav = collectionNav([group("a", "b")], is("a"));
    expect(nav?.prev).toBeNull();
    expect(nav?.next).toEqual({ id: "b" });
  });

  it("na última posição não tem próximo", () => {
    const nav = collectionNav([group("a", "b")], is("b"));
    expect(nav?.prev).toEqual({ id: "a" });
    expect(nav?.next).toBeNull();
  });

  // Item de catálogo, fora da biblioteca: não pertence a grupo nenhum.
  it("devolve null quando o item não está em grupo algum", () => {
    expect(collectionNav([group("a", "b")], is("z"))).toBeNull();
  });

  it("devolve null para coleção de um item só", () => {
    expect(collectionNav([group("a")], is("a"))).toBeNull();
  });

  it("respeita a ordem dos membros como vieram", () => {
    const nav = collectionNav([group("c", "a", "b")], is("a"));
    expect(nav?.prev).toEqual({ id: "c" });
    expect(nav?.next).toEqual({ id: "b" });
  });

  // O YouTube reduz a expansão pelo filtro de tag: navegar tem de seguir a lista
  // reduzida, senão o "próximo" leva a um item fora de vista.
  it("usa a lista reduzida por membersOf", () => {
    const groups = [group("a", "b", "c")];
    const nav = collectionNav(
      groups,
      is("a"),
      (g) => g.members.filter((m) => m.id !== "b")
    );
    expect(nav?.total).toBe(2);
    expect(nav?.next).toEqual({ id: "c" });
  });

  it("devolve null quando o filtro da expansão deixa o item sozinho", () => {
    const groups = [group("a", "b")];
    expect(collectionNav(groups, is("a"), (g) => g.members.filter((m) => m.id === "a"))).toBeNull();
  });
});
