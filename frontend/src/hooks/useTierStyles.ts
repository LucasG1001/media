import { useCallback, useMemo, useState } from "react";
import { cssVar } from "../utils/cssVar";
import { TIER_ROW_ORDER, type TierRowId } from "../utils/tierList";
import {
  DEFAULT_TIER_LABELS,
  TIER_COLOR_TOKENS,
  parseTierOverrides,
  resolveTierStyles,
  type TierOverrides,
  type TierStyleBase,
} from "../utils/tierStyles";

const STORAGE_KEY = "tier-list-styles";

function readStored(): TierOverrides {
  try {
    return parseTierOverrides(localStorage.getItem(STORAGE_KEY));
  } catch {
    return {};
  }
}

// Rótulos e cores das faixas ficam no navegador (localStorage), não no banco:
// são preferência de exibição, e o padrão já cobre quem nunca editou.
export function useTierStyles() {
  const [overrides, setOverrides] = useState<TierOverrides>(readStored);

  const defaults = useMemo(() => {
    const base = {} as Record<TierRowId, TierStyleBase>;
    for (const id of TIER_ROW_ORDER) {
      base[id] = { label: DEFAULT_TIER_LABELS[id], color: cssVar(TIER_COLOR_TOKENS[id]) };
    }
    return base;
  }, []);

  const styles = useMemo(
    () =>
      resolveTierStyles(defaults, overrides, {
        onLight: cssVar("--color-bg-primary"),
        onDark: cssVar("--color-text-primary"),
      }),
    [defaults, overrides]
  );

  const save = useCallback((next: TierOverrides) => {
    setOverrides(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Sem armazenamento (modo privado/cota): a edição vale só nesta sessão.
    }
  }, []);

  return { styles, defaults, save };
}
