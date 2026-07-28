export type SeriesAirGroup = "on_air" | "finished" | "upcoming";

export const SERIES_AIR_GROUP_LABELS: Record<SeriesAirGroup, string> = {
  on_air: "No ar",
  finished: "Finalizada",
  upcoming: "Em breve",
};

// Agrupa o status cru do TMDB nos três estados do filtro de Exibição. Série sem
// airStatus (linha ainda não sincronizada) cai no RELEASED/UPCOMING derivado da
// data de estreia — o job de 30 min preenche o airStatus e corrige sozinho.
export function seriesAirGroup(airStatus: string | null, seriesStatus: string): SeriesAirGroup {
  switch (airStatus) {
    case "Returning Series":
      return "on_air";
    case "Ended":
    case "Canceled":
      return "finished";
    case "In Production":
    case "Planned":
      return "upcoming";
    default:
      return seriesStatus === "UPCOMING" ? "upcoming" : "on_air";
  }
}

export function getAirStatusLabel(status: string | null): string {
  switch (status) {
    case "Returning Series": return "Em exibição";
    case "Ended": return "Finalizada";
    case "Canceled": return "Cancelada";
    case "In Production": return "Em produção";
    case "Planned": return "Planejada";
    default: return status ?? "N/A";
  }
}

export function formatAirDate(date: string | null): string {
  if (!date) return "N/A";
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
