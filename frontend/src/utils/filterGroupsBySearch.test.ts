import { describe, it, expect } from "vitest";
import { filterGroupsBySearch } from "./filterGroupsBySearch";

function group(representative: string, members: string[]) {
  return {
    representative: { title: representative },
    members: members.map((title) => ({ title })),
  };
}

describe("filterGroupsBySearch", () => {
  it("acha pelo título de um membro", () => {
    const groups = [group("Trilogia", ["Filme A", "Filme B"]), group("Outra", ["Filme C"])];
    expect(filterGroupsBySearch(groups, "filme b")).toEqual([groups[0]]);
  });

  // O caso das séries: os membros são as temporadas e o nome da série só existe
  // no representante.
  it("acha pelo título do representante quando os membros têm outro nome", () => {
    const groups = [group("Arcane", ["Temporada 1", "Temporada 2"]), group("Outra", ["Temporada 1"])];
    expect(filterGroupsBySearch(groups, "arcane")).toEqual([groups[0]]);
  });

  it("devolve tudo com busca vazia e nada sem casamento", () => {
    const groups = [group("Arcane", ["Temporada 1"])];
    expect(filterGroupsBySearch(groups, "   ")).toEqual(groups);
    expect(filterGroupsBySearch(groups, "invasão")).toEqual([]);
  });
});
