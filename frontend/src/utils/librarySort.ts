// Média das notas dos membros com nota (score > 0); 0 quando nenhum tem nota
// (tratado como "sem nota" por compareByScore e não exibido no card).
export function averageScore<T extends { score: number }>(members: T[]): number {
  const scored = members.filter((m) => m.score > 0);
  return scored.length ? scored.reduce((sum, m) => sum + m.score, 0) / scored.length : 0;
}

export function compareByScore<T extends { score: number }>(
  a: T,
  b: T,
  dir: "desc" | "asc"
): number {
  const aHas = a.score > 0;
  const bHas = b.score > 0;
  if (aHas !== bHas) return aHas ? -1 : 1;
  const diff = a.score - b.score;
  return dir === "desc" ? -diff : diff;
}
