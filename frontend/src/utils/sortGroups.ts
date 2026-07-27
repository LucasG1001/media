import { averageScore, compareByScore } from "./librarySort";
import type { CollectionGroup } from "./buildCollectionGroups";
import type { SortDir } from "../hooks/useSingleSort";

// Ordenações com base na coleção: as chaves são derivadas dos membros do grupo
// (já reduzidos pelo filtro), não do representante isolado.

export function sortGroupsByMemberDate<E>(
  groups: CollectionGroup<E>[],
  dateOf: (m: E) => number,
  dir: SortDir,
  agg: "oldest" | "latest" = "oldest"
): CollectionGroup<E>[] {
  const key = (g: CollectionGroup<E>) => {
    const times = g.members.map(dateOf);
    return agg === "oldest" ? Math.min(...times) : Math.max(...times);
  };
  return [...groups].sort((a, b) => {
    const diff = key(a) - key(b);
    return dir === "desc" ? -diff : diff;
  });
}

// Média das notas dos membros com nota (score > 0); coleções sem nota vão para o
// fim (média 0 → tratado como "sem nota" por compareByScore).
export function sortGroupsByAvgScore<E extends { score: number }>(
  groups: CollectionGroup<E>[],
  dir: SortDir
): CollectionGroup<E>[] {
  return [...groups].sort((a, b) =>
    compareByScore({ score: averageScore(a.members) }, { score: averageScore(b.members) }, dir)
  );
}

export function sortGroupsBySumViews<E>(
  groups: CollectionGroup<E>[],
  viewsOf: (m: E) => number,
  dir: SortDir
): CollectionGroup<E>[] {
  const sum = (g: CollectionGroup<E>) => g.members.reduce((total, m) => total + viewsOf(m), 0);
  return [...groups].sort((a, b) => {
    const diff = sum(a) - sum(b);
    return dir === "desc" ? -diff : diff;
  });
}

export function sortGroupsByName<E>(
  groups: CollectionGroup<E>[],
  nameOf: (g: CollectionGroup<E>) => string,
  dir: SortDir
): CollectionGroup<E>[] {
  return [...groups].sort((a, b) => {
    const diff = nameOf(a).localeCompare(nameOf(b), "pt", { sensitivity: "base" });
    return dir === "desc" ? -diff : diff;
  });
}
