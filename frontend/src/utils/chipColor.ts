const CHIP_COLORS = 8;

// Hash estável (djb2) do nome normalizado: o mesmo valor recebe sempre a mesma cor,
// sem precisar guardar cor no banco.
export function chipColorIndex(value: string): number {
  const normalized = value.trim().toLowerCase();
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % CHIP_COLORS) + 1;
}

export function chipColorVars(value: string): { color: string; background: string } {
  const index = chipColorIndex(value);
  return {
    color: `var(--color-chip-${index})`,
    background: `var(--color-chip-${index}-subtle)`,
  };
}
