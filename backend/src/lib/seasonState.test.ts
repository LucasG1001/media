import { describe, expect, it } from "vitest";
import { mergeSeasonState } from "./seasonState.js";

const NOW = new Date("2026-10-16T12:00:00.000Z");
const EARLIER = "2025-01-01T00:00:00.000Z";

describe("mergeSeasonState", () => {
  it("grava o último acesso ao sair do reassistindo para assistido", () => {
    const next = mergeSeasonState(
      { status: "rewatching", score: 8, lastAccessAt: EARLIER },
      { status: "watched", score: 8 },
      NOW
    );
    expect(next.lastAccessAt).toBe(NOW.toISOString());
  });

  it("não mexe no último acesso ao entrar no reassistindo", () => {
    const next = mergeSeasonState(
      { status: "watched", score: 8, lastAccessAt: EARLIER },
      { status: "rewatching", score: 8 },
      NOW
    );
    expect(next.lastAccessAt).toBe(EARLIER);
  });

  it("não mexe no último acesso ao salvar só a nota de uma temporada assistida", () => {
    const next = mergeSeasonState(
      { status: "watched", score: 7, lastAccessAt: EARLIER },
      { status: "watched", score: 9 },
      NOW
    );
    expect(next).toEqual({ status: "watched", score: 9, lastAccessAt: EARLIER });
  });

  it("preserva a anotação no merge", () => {
    const next = mergeSeasonState(
      { status: "plan_to_watch", score: 0, notes: "boa" },
      { status: "rewatching", score: 0 },
      NOW
    );
    expect(next.notes).toBe("boa");
    expect(next.status).toBe("rewatching");
  });
});
