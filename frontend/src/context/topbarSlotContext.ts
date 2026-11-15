import { createContext, useContext } from "react";

interface TopbarSlotValue {
  // O elemento da barra superior que recebe o cabeçalho da página. null = ainda
  // não montou, ou não há barra (teste de componente isolado).
  slot: HTMLElement | null;
  setSlot: (element: HTMLElement | null) => void;
}

export const TopbarSlotContext = createContext<TopbarSlotValue>({ slot: null, setSlot: () => {} });

export function useTopbarSlot(): TopbarSlotValue {
  return useContext(TopbarSlotContext);
}
