import { describe, it, expect } from "vitest";
import {
  episodesLabel,
  findGroupOf,
  isCompleted,
  pickWatchEntry,
  statusTone,
  topGenres,
  yearOf,
  yearSpan,
} from "./collectionWatch";

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

describe("statusTone e isCompleted", () => {
  it("dá o mesmo papel aos status de cada mídia", () => {
    expect(statusTone("plan_to_watch")).toBe("plan");
    expect(statusTone("plan_to_play")).toBe("plan");
    expect(statusTone("watched")).toBe("done");
    expect(statusTone("beaten")).toBe("done");
    expect(statusTone("rewatching")).toBe("revisit");
    expect(statusTone("replaying")).toBe("revisit");
    expect(statusTone("dropped")).toBe("dropped");
  });

  it("a revisita conta como concluído; planejo e abandonado não", () => {
    expect(isCompleted("watched")).toBe(true);
    expect(isCompleted("replaying")).toBe(true);
    expect(isCompleted("plan_to_watch")).toBe(false);
    expect(isCompleted("dropped")).toBe(false);
  });
});

describe("yearSpan", () => {
  it("vai do primeiro ao último ano, ignorando item sem data", () => {
    expect(yearSpan([2011, null, 2001, 2005])).toBe("2001–2011");
  });

  it("um ano só quando todos coincidem, e nada quando nenhum tem data", () => {
    expect(yearSpan([2009, 2009])).toBe("2009");
    expect(yearSpan([null])).toBeNull();
    expect(yearSpan([])).toBeNull();
  });
});

describe("topGenres", () => {
  it("ordena pelos mais comuns e corta no limite", () => {
    const lists = [["Ação", "Drama"], ["Drama", "Fantasia"], ["Drama", "Ação"], null, ["Terror"]];
    expect(topGenres(lists)).toEqual(["Drama", "Ação", "Fantasia"]);
    expect(topGenres(lists, 1)).toEqual(["Drama"]);
  });

  it("sem gênero em nenhum item não devolve nada", () => {
    expect(topGenres([null, undefined, []])).toEqual([]);
  });
});

describe("yearOf e episodesLabel", () => {
  it("lê o ano de uma data ISO", () => {
    expect(yearOf("2019-04-01")).toBe(2019);
    expect(yearOf(null)).toBeNull();
    expect(yearOf("")).toBeNull();
  });

  it("escreve a contagem de episódios no singular e no plural", () => {
    expect(episodesLabel(1)).toBe("1 ep");
    expect(episodesLabel(24)).toBe("24 eps");
    expect(episodesLabel(null)).toBeNull();
    expect(episodesLabel(0)).toBeNull();
  });
});
