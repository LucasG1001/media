import { useMemo, useState, type ReactNode } from "react";
import { TopbarSlotContext } from "./topbarSlotContext";

// Liga a barra superior (que registra o elemento do slot) às páginas (que mandam
// o cabeçalho para ele). O elemento vai em estado, não em ref: a página precisa
// renderizar de novo quando ele aparece.
export function TopbarSlotProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ slot, setSlot }), [slot]);
  return <TopbarSlotContext.Provider value={value}>{children}</TopbarSlotContext.Provider>;
}
