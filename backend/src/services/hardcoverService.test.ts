import { describe, it, expect } from "vitest";
import { deriveBookStatus, authorOverlapRatio, isQualityDocument } from "./hardcoverService.js";
import type { HardcoverSearchDocument } from "../types/book.js";

const CURRENT_YEAR = new Date().getUTCFullYear();

describe("deriveBookStatus", () => {
  it("usa a data quando existe", () => {
    expect(deriveBookStatus("2006-01-01", 2006)).toBe("RELEASED");
    expect(deriveBookStatus("2099-12-01", 2099)).toBe("UPCOMING");
  });

  // O motivo de não copiar o deriveStatus do TMDB: lá data nula é "sem data marcada" e
  // devolve UPCOMING; aqui data nula é "a Hardcover não sabe" e o livro em geral é antigo.
  it("cai no ano quando a data é nula", () => {
    expect(deriveBookStatus(null, 1949)).toBe("RELEASED");
    expect(deriveBookStatus(null, CURRENT_YEAR + 3)).toBe("UPCOMING");
  });

  it("sem data e sem ano assume lançado, não 'em breve'", () => {
    expect(deriveBookStatus(null, null)).toBe("RELEASED");
  });
});

describe("authorOverlapRatio", () => {
  const set = (...names: string[]) => new Set(names);

  // O caso real do "1984" (id 379760), que a Hardcover marca como membro de
  // "Rosato and Associates", 11 thrillers da Lisa Scottoline: 1 de 11 casa.
  it("rejeita série mal marcada", () => {
    const seed = set("george orwell");
    const members = [set("george orwell"), ...Array.from({ length: 10 }, () => set("lisa scottoline"))];
    const ratio = authorOverlapRatio(seed, members);
    expect(ratio).toBeCloseTo(1 / 11);
    expect(ratio).toBeLessThan(0.5);
  });

  it("aceita série coerente", () => {
    const seed = set("j k rowling");
    const members = Array.from({ length: 9 }, () => set("j k rowling"));
    expect(authorOverlapRatio(seed, members)).toBe(1);
  });

  // Coautoria: basta um nome em comum (Dune tem Frank e Brian Herbert).
  it("casa por interseção, não por igualdade", () => {
    const seed = set("frank herbert", "brian herbert");
    const members = [set("frank herbert"), set("brian herbert", "kevin j anderson")];
    expect(authorOverlapRatio(seed, members)).toBe(1);
  });

  it("série sem membro nenhum não passa", () => {
    expect(authorOverlapRatio(set("alguem"), [])).toBe(0);
  });
});

describe("isQualityDocument", () => {
  const doc = (over: Partial<HardcoverSearchDocument> = {}): HardcoverSearchDocument => ({
    id: 1,
    title: "Livro",
    users_count: 5000,
    author_names: ["Autor"],
    image: { url: "https://exemplo/capa.jpg" },
    compilation: false,
    ...over,
  });

  it("aceita registro popular e completo", () => {
    expect(isQualityDocument(doc())).toBe(true);
  });

  // É o que impede o stub de 3 leitores de ganhar da obra certa por casar o título exato.
  it("descarta stub de poucos leitores", () => {
    expect(isQualityDocument(doc({ users_count: 3 }))).toBe(false);
  });

  it("descarta sem capa, sem autor e compilação", () => {
    expect(isQualityDocument(doc({ image: null }))).toBe(false);
    expect(isQualityDocument(doc({ author_names: [] }))).toBe(false);
    expect(isQualityDocument(doc({ compilation: true }))).toBe(false);
  });

  it("trata users_count ausente como zero", () => {
    expect(isQualityDocument(doc({ users_count: undefined }))).toBe(false);
  });
});
