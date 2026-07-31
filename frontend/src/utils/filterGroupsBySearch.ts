export function filterGroupsBySearch<
  T extends { representative: { title: string }; members: { title: string }[] }
>(groups: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  const matches = (title: string) => title.toLowerCase().includes(q);
  // O representante entra na busca por causa das séries: lá os membros são as
  // temporadas ("Temporada 1"...) e o nome da série existe só nele. Nas outras
  // mídias o representante também é um dos membros, então nada muda.
  return groups.filter(
    (g) => matches(g.representative.title) || g.members.some((m) => matches(m.title))
  );
}
