import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, cleanup, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TopbarSlot } from "./TopbarSlot";
import { TopbarSlotProvider } from "../../context/TopbarSlotProvider";
import { Sidebar } from "../Sidebar/Sidebar";

function stubViewport(mobile: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: mobile,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => stubViewport(false));
afterEach(cleanup);

// A barra superior de verdade, com uma "página" que manda o cabeçalho para ela.
function renderApp() {
  render(
    <MemoryRouter>
      <TopbarSlotProvider>
        <Sidebar />
        <main>
          <TopbarSlot inlineClassName="linha-da-pagina">
            <span>abas da mídia</span>
          </TopbarSlot>
        </main>
      </TopbarSlotProvider>
    </MemoryRouter>
  );
}

describe("TopbarSlot", () => {
  it("no desktop renderiza o cabeçalho dentro da barra superior, fora da página", () => {
    renderApp();
    expect(within(screen.getByRole("banner")).getByText("abas da mídia")).toBeTruthy();
    expect(within(screen.getByRole("main")).queryByText("abas da mídia")).toBeNull();
  });

  // No celular a barra superior não existe (display: none): o cabeçalho tem que
  // ficar na página, no invólucro que dá o espaçamento da linha.
  it("no celular mantém o cabeçalho na página", () => {
    stubViewport(true);
    renderApp();
    const header = within(screen.getByRole("main")).getByText("abas da mídia");
    expect(header.parentElement?.className).toBe("linha-da-pagina");
    expect(within(screen.getByRole("banner")).queryByText("abas da mídia")).toBeNull();
  });

  it("sem barra nenhuma renderiza no lugar", () => {
    render(
      <main>
        <TopbarSlot inlineClassName="linha-da-pagina">
          <span>abas da mídia</span>
        </TopbarSlot>
      </main>
    );
    expect(screen.getByText("abas da mídia").parentElement?.className).toBe("linha-da-pagina");
  });
});
