import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTopbarSlot } from "../../context/topbarSlotContext";
import { useIsMobile } from "../../hooks/useIsMobile";

interface TopbarSlotProps {
  children: ReactNode;
  // Classe do invólucro quando o conteúdo fica na página (espaçamento da linha
  // que ele ocupa ali).
  inlineClassName?: string;
}

// Cabeçalho de página que mora na barra superior: no desktop o conteúdo é
// renderizado dentro dela (portal), economizando uma linha da página. No celular
// a barra não existe, então ele fica no lugar em que foi escrito — e o mesmo
// vale sem barra nenhuma.
export function TopbarSlot({ children, inlineClassName }: TopbarSlotProps) {
  const { slot } = useTopbarSlot();
  const mobile = useIsMobile();

  if (slot && !mobile) return createPortal(children, slot);
  return <div className={inlineClassName}>{children}</div>;
}
