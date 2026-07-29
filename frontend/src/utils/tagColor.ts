const TAG_COLORS = 8;

// Hash estável (djb2) do nome normalizado: a mesma tag recebe sempre a mesma cor,
// em qualquer coleção, sem precisar guardar cor no banco.
export function tagColorIndex(tag: string): number {
  const normalized = tag.trim().toLowerCase();
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % TAG_COLORS) + 1;
}

export function tagColorVars(tag: string): { color: string; background: string } {
  const index = tagColorIndex(tag);
  return {
    color: `var(--color-tag-${index})`,
    background: `var(--color-tag-${index}-subtle)`,
  };
}
