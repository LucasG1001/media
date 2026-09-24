import { describe, it, expect } from "vitest";
import { buildGenreOptions, hasAllGenres, sameGenres, toggleGenre } from "./genreFacets";

const items = [
  { id: 1, genres: ["Terror", "Aventura"] },
  { id: 2, genres: ["Terror", "Drama"] },
  { id: 3, genres: ["Comédia", "Aventura"] },
  { id: 4, genres: null },
];
const get = (i: (typeof items)[number]) => i.genres;

describe("hasAllGenres", () => {
  it("passa tudo sem seleção, inclusive item sem gênero", () => {
    expect(hasAllGenres(null, [])).toBe(true);
  });

  it("exige todos os marcados (E)", () => {
    expect(hasAllGenres(["Terror", "Aventura"], ["Terror", "Aventura"])).toBe(true);
    expect(hasAllGenres(["Terror", "Drama"], ["Terror", "Aventura"])).toBe(false);
    expect(hasAllGenres(null, ["Terror"])).toBe(false);
  });
});

describe("buildGenreOptions", () => {
  it("sem seleção lista todos com contagem, maior primeiro", () => {
    const opts = buildGenreOptions(items, [], get);
    expect(opts.map((o) => [o.value, o.count])).toEqual([
      ["Aventura", 2],
      ["Terror", 2],
      ["Comédia", 1],
      ["Drama", 1],
    ]);
  });

  it("encolhe para os gêneros que coexistem com o marcado", () => {
    const opts = buildGenreOptions(items, ["Terror"], get);
    expect(opts.map((o) => o.value)).toEqual(["Terror", "Aventura", "Drama"]);
    expect(opts.find((o) => o.value === "Comédia")).toBeUndefined();
  });

  it("mantém o marcado mesmo sem nenhum item restante", () => {
    const opts = buildGenreOptions([items[2]], ["Terror"], get);
    expect(opts).toEqual([{ value: "Terror", label: "Terror", count: 0 }]);
  });

  it("aplica rótulos", () => {
    const opts = buildGenreOptions([{ genres: ["Horror"] }], [], (i) => i.genres, { Horror: "Terror" });
    expect(opts[0]).toEqual({ value: "Horror", label: "Terror", count: 1 });
  });
});

describe("helpers", () => {
  it("toggleGenre alterna", () => {
    expect(toggleGenre(["A"], "B")).toEqual(["A", "B"]);
    expect(toggleGenre(["A", "B"], "A")).toEqual(["B"]);
  });

  it("sameGenres compara em ordem e trata null", () => {
    expect(sameGenres(["A", "B"], ["A", "B"])).toBe(true);
    expect(sameGenres(["B", "A"], ["A", "B"])).toBe(false);
    expect(sameGenres(null, [])).toBe(false);
  });
});
