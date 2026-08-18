import { useRef, useCallback, useEffect, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent, type RefObject } from "react";

// Abaixo disso o gesto ainda é um clique: sem folga, um tremor no mouse ao
// clicar num card já viraria arrasto e engoliria o clique.
const DRAG_THRESHOLD = 5;
// Atrito por frame de ~16 ms, reescalado pelo delta real para o deslize não
// depender da taxa de quadros.
const FRICTION = 0.94;
const FRAME_MS = 1000 / 60;
// px/ms. Abaixo disso o movimento é imperceptível e a animação para.
const MIN_VELOCITY = 0.02;
// px/ms. Teto do impulso: uma amostra de ponteiro ruim (muito deslocamento num
// intervalo curtíssimo) geraria uma velocidade absurda e atiraria a faixa.
const MAX_VELOCITY = 4;
// Ponteiro parado por mais que isto antes de soltar não deve deslizar: quem
// posiciona a faixa com cuidado espera que ela fique onde parou.
const REST_MS = 60;

export interface DragScrollHandlers {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onClickCapture: (e: ReactMouseEvent) => void;
}

export interface DragScroll<T extends HTMLElement> {
  ref: RefObject<T | null>;
  handlers: DragScrollHandlers;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

// Arrastar com o mouse para rolar a faixa horizontal, com deslize por inércia ao
// soltar. Só mouse: no touch a rolagem nativa já tem inércia e interceptá-la só
// piora.
export function useDragScroll<T extends HTMLElement>(): DragScroll<T> {
  const ref = useRef<T>(null);
  const state = useRef({
    down: false,
    startX: 0,
    startScroll: 0,
    dragged: false,
    lastX: 0,
    lastAt: 0,
    velocity: 0,
  });
  const raf = useRef<number | null>(null);

  const stopGlide = useCallback(() => {
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
  }, []);

  useEffect(() => stopGlide, [stopGlide]);

  const glide = useCallback(() => {
    let previous = performance.now();
    const step = (now: number) => {
      raf.current = null;
      const el = ref.current;
      if (!el) return;
      const dt = Math.max(now - previous, 1);
      previous = now;

      const before = el.scrollLeft;
      el.scrollLeft = before - state.current.velocity * dt;
      state.current.velocity *= Math.pow(FRICTION, dt / FRAME_MS);

      // Parar na borda: sem isto a animação seguiria rodando contra o limite.
      if (el.scrollLeft === before) return;
      if (Math.abs(state.current.velocity) < MIN_VELOCITY) return;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, []);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse" || e.button !== 0) return;
    // Um toque novo interrompe o deslize em curso, como em qualquer rolagem.
    stopGlide();
    // Zera `dragged` a cada gesto novo: sem isso um arrasto que termina fora de
    // um card deixaria a supressão armada e comeria o clique seguinte.
    state.current = {
      down: true,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      dragged: false,
      lastX: e.clientX,
      lastAt: performance.now(),
      velocity: 0,
    };
  }, [stopGlide]);

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const st = state.current;
    const el = ref.current;
    if (!st.down || !el) return;
    const dx = e.clientX - st.startX;
    if (!st.dragged) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      st.dragged = true;
      // Captura só depois do limiar, para o ponteiro continuar chegando aqui
      // mesmo que o cursor saia da faixa no meio do arrasto.
      el.setPointerCapture(e.pointerId);
    }
    el.scrollLeft = st.startScroll - dx;

    const now = performance.now();
    const elapsed = now - st.lastAt;
    if (elapsed > 0) {
      // Média exponencial: a velocidade instantânea entre dois eventos oscila
      // demais para servir sozinha de impulso.
      const instant = (e.clientX - st.lastX) / elapsed;
      const blended = st.velocity === 0 ? instant : st.velocity * 0.2 + instant * 0.8;
      st.velocity = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, blended));
      st.lastX = e.clientX;
      st.lastAt = now;
    }
  }, []);

  const end = useCallback(() => {
    const st = state.current;
    if (!st.down) return;
    st.down = false;
    if (!st.dragged) return;
    const resting = performance.now() - st.lastAt > REST_MS;
    if (resting || prefersReducedMotion() || Math.abs(st.velocity) < MIN_VELOCITY) {
      st.velocity = 0;
      return;
    }
    glide();
  }, [glide]);

  // Na fase de captura, então roda antes do onClick do card: é o que impede o
  // fim de um arrasto de abrir o drawer.
  const onClickCapture = useCallback((e: ReactMouseEvent) => {
    if (!state.current.dragged) return;
    state.current.dragged = false;
    e.stopPropagation();
    e.preventDefault();
  }, []);

  return {
    ref,
    handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end, onClickCapture },
  };
}
