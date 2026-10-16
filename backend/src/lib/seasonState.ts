import type { SeriesSeasonState } from "../types/seriesLibrary.js";

// Merge, não substituição: o modal só manda status/nota e não pode apagar a
// anotação nem o último acesso da temporada, gravados por outros caminhos.
// Último acesso segue o CASE de last_access_at das outras mídias: só a transição
// para assistido conta — inclusive saindo do reassistindo, que é como se registra
// ter visto de novo. Ajustar só a nota não conta e sair do assistido não limpa.
export function mergeSeasonState(
  previous: SeriesSeasonState | undefined,
  patch: SeriesSeasonState,
  now: Date
): SeriesSeasonState {
  const next: SeriesSeasonState = { ...previous, ...patch };
  if (patch.status === "watched" && previous?.status !== "watched") {
    next.lastAccessAt = now.toISOString();
  }
  return next;
}
