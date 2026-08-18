import { describe, it, expect, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { useDrawerKeys } from "./useDrawerKeys";

// O projeto não usa os globals do vitest, então a limpeza automática do
// testing-library não roda e os renders se acumulariam entre os testes.
afterEach(() => {
  cleanup();
  setFullscreen(null);
});

function setFullscreen(el: Element | null) {
  Object.defineProperty(document, "fullscreenElement", {
    value: el,
    configurable: true,
  });
}

function Drawer({ onClose, nav }: { onClose: () => void; nav?: { onPrev?: () => void; onNext?: () => void } }) {
  useDrawerKeys(onClose, nav);
  return <div />;
}

describe("useDrawerKeys", () => {
  it("Escape fecha", () => {
    const onClose = vi.fn();
    render(<Drawer onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Em tela cheia o Escape é do navegador, para sair dela. Fechar o drawer junto
  // tiraria o usuário de dois contextos com uma tecla só.
  it("Escape não fecha em tela cheia", () => {
    const onClose = vi.fn();
    render(<Drawer onClose={onClose} />);
    setFullscreen(document.body);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("setas navegam", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(<Drawer onClose={vi.fn()} nav={{ onPrev, onNext }} />);
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("setas não fazem nada sem navegação", () => {
    const onClose = vi.fn();
    render(<Drawer onClose={onClose} />);
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("setas são ignoradas em campo de texto", () => {
    const onNext = vi.fn();
    render(<Drawer onClose={vi.fn()} nav={{ onNext }} />);
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    fireEvent.keyDown(textarea, { key: "ArrowRight" });
    expect(onNext).not.toHaveBeenCalled();
    textarea.remove();
  });

  it("trava e destrava o scroll do body", () => {
    const view = render(<Drawer onClose={vi.fn()} />);
    expect(document.body.style.overflow).toBe("hidden");
    view.unmount();
    expect(document.body.style.overflow).toBe("");
  });

  // O listener registra uma vez só, mas precisa enxergar o callback atual.
  it("usa o callback mais recente após re-render", () => {
    const primeiro = vi.fn();
    const segundo = vi.fn();
    const view = render(<Drawer onClose={primeiro} />);
    view.rerender(<Drawer onClose={segundo} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(primeiro).not.toHaveBeenCalled();
    expect(segundo).toHaveBeenCalledTimes(1);
  });
});
