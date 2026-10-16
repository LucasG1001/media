import { describe, expect, it } from "vitest";
import { jobsEnabled } from "./jobsEnabled.js";

describe("jobsEnabled", () => {
  it("liga os jobs quando DISABLE_JOBS não está definida", () => {
    expect(jobsEnabled({})).toBe(true);
  });

  it("desliga os jobs com DISABLE_JOBS=true, sem diferenciar caixa nem espaço", () => {
    expect(jobsEnabled({ DISABLE_JOBS: "true" })).toBe(false);
    expect(jobsEnabled({ DISABLE_JOBS: " TRUE " })).toBe(false);
  });

  it("mantém os jobs ligados com qualquer outro valor", () => {
    expect(jobsEnabled({ DISABLE_JOBS: "" })).toBe(true);
    expect(jobsEnabled({ DISABLE_JOBS: "false" })).toBe(true);
    expect(jobsEnabled({ DISABLE_JOBS: "1" })).toBe(true);
  });
});
