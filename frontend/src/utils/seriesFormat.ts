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
