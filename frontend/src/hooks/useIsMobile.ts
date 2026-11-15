import { useSyncExternalStore } from "react";

// O mesmo corte das media queries do CSS (barra inferior no lugar da superior).
const QUERY = "(max-width: 768px)";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia?.(QUERY);
  if (!media?.addEventListener) return () => {};
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia?.(QUERY).matches ?? false;
}

// Para quando o CSS não basta: decidir ONDE um elemento é renderizado, não só
// como ele aparece.
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
