import { useEffect, useRef } from "react";

// Setas dentro de campo de texto movem o cursor — o NotesBlock é uma textarea.
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export interface DrawerKeyNav {
  onPrev?: () => void;
  onNext?: () => void;
}

// Teclado e trava de scroll dos drawers: Escape fecha e, havendo navegação de
// coleção, ← e → andam por ela. Os callbacks vão por ref para o listener
// registrar uma vez só — antes cada drawer o re-registrava a cada render, já que
// `onClose` costuma ser arrow inline na página.
export function useDrawerKeys(onClose: () => void, nav?: DrawerKeyNav): void {
  const latest = useRef({ onClose, nav });
  useEffect(() => {
    latest.current = { onClose, nav };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { onClose: close, nav: current } = latest.current;
      if (e.key === "Escape") {
        // Em tela cheia o Escape é para sair dela, não para fechar o drawer.
        if (!document.fullscreenElement) close();
        return;
      }
      if (!current || isTyping(e.target)) return;
      if (e.key === "ArrowLeft") current.onPrev?.();
      else if (e.key === "ArrowRight") current.onNext?.();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, []);
}
