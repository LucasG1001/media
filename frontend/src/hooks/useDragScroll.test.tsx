import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { useDragScroll } from "./useDragScroll";

const onClick = vi.fn();

function Carousel() {
  const { ref, handlers } = useDragScroll<HTMLDivElement>();
  return (
    <div data-testid="track" ref={ref} {...handlers}>
      <button type="button" data-testid="card" onClick={onClick}>
        card
      </button>
    </div>
  );
}

function setup() {
  onClick.mockClear();
  const view = render(<Carousel />);
  const track = view.getByTestId("track");
  track.scrollLeft = 0;
  return { track, card: view.getByTestId("card") };
}

const mouse = (clientX: number) => ({ pointerType: "mouse", button: 0, pointerId: 1, clientX });

// O projeto não usa os globals do vitest, então a limpeza automática do
// testing-library não roda e os renders se acumulariam entre os testes.
afterEach(cleanup);

// Controla o rAF: em vez de esperar frames reais, o teste avança quadro a
// quadro com um delta fixo.
let frames: FrameRequestCallback[] = [];
let clock = 0;

function runFrames(count: number, deltaMs = 16) {
  for (let i = 0; i < count; i += 1) {
    const pending = frames;
    frames = [];
    if (pending.length === 0) return;
    clock += deltaMs;
    for (const cb of pending) cb(clock);
  }
}

beforeAll(() => {
  // jsdom não implementa captura de ponteiro nem matchMedia.
  HTMLElement.prototype.setPointerCapture = () => {};
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;

  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    frames = [];
  });
});

beforeEach(() => {
  frames = [];
  clock = 0;
});

describe("useDragScroll", () => {
  it("rola a faixa no sentido oposto ao arrasto", () => {
    const { track } = setup();
    fireEvent.pointerDown(track, mouse(500));
    fireEvent.pointerMove(track, mouse(420));
    expect(track.scrollLeft).toBe(80);
  });

  it("continua a partir da posição em que a faixa estava", () => {
    const { track } = setup();
    track.scrollLeft = 200;
    fireEvent.pointerDown(track, mouse(500));
    fireEvent.pointerMove(track, mouse(450));
    expect(track.scrollLeft).toBe(250);
  });

  it("ignora tremor abaixo do limiar", () => {
    const { track } = setup();
    fireEvent.pointerDown(track, mouse(500));
    fireEvent.pointerMove(track, mouse(497));
    expect(track.scrollLeft).toBe(0);
  });

  it("deixa o clique passar quando não houve arrasto", () => {
    const { track, card } = setup();
    fireEvent.pointerDown(track, mouse(500));
    fireEvent.pointerMove(track, mouse(498));
    fireEvent.pointerUp(track);
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("engole o clique que veio de um arrasto", () => {
    const { track, card } = setup();
    fireEvent.pointerDown(track, mouse(500));
    fireEvent.pointerMove(track, mouse(400));
    fireEvent.pointerUp(track);
    fireEvent.click(card);
    expect(onClick).not.toHaveBeenCalled();
  });

  // Arrasto terminado fora de um card não dispara clique, então a supressão
  // ficaria armada e comeria o clique seguinte.
  it("volta a aceitar clique no gesto seguinte", () => {
    const { track, card } = setup();
    fireEvent.pointerDown(track, mouse(500));
    fireEvent.pointerMove(track, mouse(400));
    fireEvent.pointerUp(track);

    fireEvent.pointerDown(track, mouse(300));
    fireEvent.pointerUp(track);
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("não segue o ponteiro depois de solto", () => {
    const { track } = setup();
    fireEvent.pointerDown(track, mouse(500));
    fireEvent.pointerMove(track, mouse(400));
    fireEvent.pointerUp(track);
    const afterRelease = track.scrollLeft;
    fireEvent.pointerMove(track, mouse(200));
    expect(track.scrollLeft).toBe(afterRelease);
  });

  describe("inércia", () => {
    // O tranco que se sentia ao soltar era o scroll-snap puxando a faixa de
    // volta; agora o movimento continua e desacelera.
    it("continua deslizando depois de soltar", () => {
      const { track } = setup();
      fireEvent.pointerDown(track, mouse(500));
      fireEvent.pointerMove(track, mouse(400));
      fireEvent.pointerUp(track);
      const afterRelease = track.scrollLeft;
      runFrames(3);
      expect(track.scrollLeft).toBeGreaterThan(afterRelease);
    });

    it("desacelera até parar", () => {
      const { track } = setup();
      fireEvent.pointerDown(track, mouse(500));
      fireEvent.pointerMove(track, mouse(400));
      fireEvent.pointerUp(track);

      runFrames(200);
      const parado = track.scrollLeft;
      runFrames(20);
      expect(track.scrollLeft).toBe(parado);
    });

    it("não desliza quando o gesto não passou do limiar", () => {
      const { track } = setup();
      fireEvent.pointerDown(track, mouse(500));
      fireEvent.pointerMove(track, mouse(498));
      fireEvent.pointerUp(track);
      runFrames(3);
      expect(track.scrollLeft).toBe(0);
    });

    // Sem teto, uma amostra de ponteiro ruim (muito deslocamento em tempo
    // quase nulo) atiraria a faixa para longe.
    it("limita o impulso de um salto brusco do ponteiro", () => {
      const { track } = setup();
      fireEvent.pointerDown(track, mouse(5000));
      fireEvent.pointerMove(track, mouse(0));
      fireEvent.pointerUp(track);
      const aoSoltar = track.scrollLeft;
      runFrames(1);
      // 4 px/ms de teto num quadro de 16 ms.
      expect(track.scrollLeft - aoSoltar).toBeLessThanOrEqual(4 * 16);
    });

    it("um novo toque interrompe o deslize", () => {
      const { track } = setup();
      fireEvent.pointerDown(track, mouse(500));
      fireEvent.pointerMove(track, mouse(400));
      fireEvent.pointerUp(track);
      runFrames(1);

      fireEvent.pointerDown(track, mouse(300));
      const aoTocar = track.scrollLeft;
      runFrames(5);
      expect(track.scrollLeft).toBe(aoTocar);
    });
  });

  // No touch a rolagem nativa já tem inércia; interceptá-la só piora.
  it("não intercepta gesto de toque", () => {
    const { track } = setup();
    fireEvent.pointerDown(track, { pointerType: "touch", button: 0, pointerId: 2, clientX: 500 });
    fireEvent.pointerMove(track, { pointerType: "touch", button: 0, pointerId: 2, clientX: 400 });
    expect(track.scrollLeft).toBe(0);
  });

  it("ignora botão que não seja o principal", () => {
    const { track } = setup();
    fireEvent.pointerDown(track, { pointerType: "mouse", button: 2, pointerId: 1, clientX: 500 });
    fireEvent.pointerMove(track, mouse(400));
    expect(track.scrollLeft).toBe(0);
  });
});
