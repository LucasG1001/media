export interface CollectionGroup<T> {
  key: string;
  representative: T;
  members: T[];
  count: number;
  completedCount: number;
}

export interface BuildGroupsConfig<T> {
  getKey: (entry: T) => string;
  compareMembers: (a: T, b: T) => number;
  reverseMembers?: boolean;
  // Quando presente, decide só quais coleções aparecem (pelo menos um membro passa)
  // e o numerador do badge; capa e expansão continuam sendo da coleção inteira.
  memberFilter?: (entry: T) => boolean;
}

export function pickRepresentative<T extends { isCover?: boolean }>(ordered: T[]): T {
  return ordered.find((m) => m.isCover) ?? ordered[0];
}

export function buildCollectionGroups<T extends { isCover?: boolean }>(
  entries: T[],
  config: BuildGroupsConfig<T>
): CollectionGroup<T>[] {
  const { getKey, compareMembers, reverseMembers = true, memberFilter } = config;

  const map = new Map<string, T[]>();
  for (const entry of entries) {
    const key = getKey(entry);
    const list = map.get(key);
    if (list) list.push(entry);
    else map.set(key, [entry]);
  }

  const groups: CollectionGroup<T>[] = [];
  map.forEach((members, key) => {
    const ordered = [...members].sort(compareMembers);
    // `count` é SEMPRE o total da coleção; `completedCount` é a quantidade que
    // bate no filtro (ex.: 3/6), ou o total sem filtro (6/6).
    const matched = memberFilter ? ordered.filter(memberFilter).length : ordered.length;
    if (matched === 0) return;
    groups.push({
      key,
      representative: pickRepresentative(ordered),
      members: reverseMembers ? [...ordered].reverse() : ordered,
      count: ordered.length,
      completedCount: matched,
    });
  });

  return groups;
}
