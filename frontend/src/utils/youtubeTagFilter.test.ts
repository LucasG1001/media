import { describe, it, expect } from "vitest";
import { visibleMembers } from "./youtubeTagFilter";
import { NO_TAG } from "../components/TagFilterBar/noTag";
import type { YoutubeLibraryEntry } from "../types/youtubeLibrary";

let seq = 0;

function video(tags: string[]): YoutubeLibraryEntry {
  seq += 1;
  return { id: `uuid-${seq}`, videoId: `v${seq}`, tags } as YoutubeLibraryEntry;
}

describe("visibleMembers", () => {
  it("devolve tudo sem filtro", () => {
    const members = [video([]), video(["a"])];
    expect(visibleMembers(members, [])).toEqual(members);
  });

  it("exige todas as tags marcadas (E, não OU)", () => {
    const ambas = video(["a", "b"]);
    const so_a = video(["a"]);
    expect(visibleMembers([ambas, so_a], ["a", "b"])).toEqual([ambas]);
  });

  it("filtra por uma tag só", () => {
    const com = video(["a"]);
    const sem = video(["b"]);
    expect(visibleMembers([com, sem], ["a"])).toEqual([com]);
  });

  // "Sem tag" é o único recorte que o E não alcançaria: vídeo sem tag nunca casa
  // com tag alguma.
  it("com 'sem tag' devolve só os sem tag nenhuma", () => {
    const vazio = video([]);
    const marcado = video(["a"]);
    expect(visibleMembers([vazio, marcado], [NO_TAG])).toEqual([vazio]);
  });

  it("'sem tag' é exclusivo: ignora companheiras", () => {
    const vazio = video([]);
    const marcado = video(["a"]);
    expect(visibleMembers([vazio, marcado], [NO_TAG, "a"])).toEqual([vazio]);
  });

  it("preserva a ordem recebida", () => {
    const a = video(["x"]);
    const b = video(["x"]);
    const c = video(["x"]);
    expect(visibleMembers([a, b, c], ["x"])).toEqual([a, b, c]);
  });
});
