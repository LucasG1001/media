import { describe, expect, it } from "vitest";
import { completedOnInsertSql, completionUpdateSql, lastAccessUpdateSql } from "./completionSql.js";

const squash = (sql: string) => sql.replace(/\s+/g, " ").trim();
const rule = { whenStatus: "watched", rewatchStatus: "rewatching" };

describe("completedOnInsertSql", () => {
  it("grava só ao entrar já concluído", () => {
    expect(completedOnInsertSql("$4", "watched")).toBe("CASE WHEN $4 = 'watched' THEN NOW() ELSE NULL END");
  });
});

describe("completionUpdateSql", () => {
  const sql = squash(completionUpdateSql("watched_at", "$2", "status", rule));

  it("preserva a data ao voltar da revisita para o concluído, antes da regra de transição", () => {
    const fromRewatch = "WHEN $2 = 'watched' AND status = 'rewatching' THEN COALESCE(watched_at, NOW())";
    const transition = "WHEN $2 = 'watched' AND status != 'watched' THEN NOW()";
    expect(sql).toContain(fromRewatch);
    expect(sql.indexOf(fromRewatch)).toBeLessThan(sql.indexOf(transition));
  });

  it("mantém a data no concluído e na revisita e limpa nos demais", () => {
    expect(sql).toContain("WHEN $2 IN ('watched', 'rewatching') THEN watched_at ELSE NULL END");
  });

  it("sem revisita configurada, mantém a regra antiga", () => {
    expect(squash(completionUpdateSql("liked_at", "$2", "status", { whenStatus: "liked" }))).toBe(
      "CASE WHEN $2 = 'liked' AND status != 'liked' THEN NOW() WHEN $2 != 'liked' THEN NULL ELSE liked_at END"
    );
  });
});

describe("lastAccessUpdateSql", () => {
  it("grava em qualquer transição para o concluído (inclusive da revisita) e nunca limpa", () => {
    expect(squash(lastAccessUpdateSql("last_access_at", "$2", "status", rule))).toBe(
      "CASE WHEN $2 = 'watched' AND status != 'watched' THEN NOW() ELSE last_access_at END"
    );
  });
});
