import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, fireEvent, cleanup, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "./Sidebar";

beforeEach(() => {
  // jsdom não implementa matchMedia, que o useDismiss consulta ao abrir.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

function setup(path = "/anime") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>
  );
  // O hambúrguer existe duas vezes (barra e cabeçalho do menu); o da barra é o
  // único alcançável com o menu fechado.
  const topbar = within(screen.getByRole("banner"));
  const menu = document.getElementById("main-menu") as HTMLElement;
  return {
    menu,
    hamburger: () => topbar.getByRole("button", { name: /menu/i }),
    backdrop: () => screen.queryByTestId("menu-backdrop"),
    isOpen: () => !menu.hasAttribute("inert"),
  };
}

describe("Sidebar", () => {
  it("começa fechado", () => {
    const { hamburger, backdrop, isOpen } = setup();
    expect(hamburger().getAttribute("aria-expanded")).toBe("false");
    expect(hamburger().getAttribute("aria-label")).toBe("Abrir menu");
    expect(isOpen()).toBe(false);
    expect(backdrop()).toBeNull();
  });

  it("o hambúrguer abre o menu já com os rótulos, por cima do conteúdo", () => {
    const { menu, hamburger, backdrop, isOpen } = setup();
    fireEvent.click(hamburger());
    expect(isOpen()).toBe(true);
    expect(hamburger().getAttribute("aria-expanded")).toBe("true");
    expect(backdrop()).not.toBeNull();
    for (const label of ["Início", "Tier List", "Anime", "Filmes", "Séries", "Livros", "Jogos", "YouTube", "Configurações"]) {
      expect(within(menu).getByRole("link", { name: label })).toBeTruthy();
    }
  });

  it("o hambúrguer do próprio menu fecha", () => {
    const { menu, hamburger, isOpen } = setup();
    fireEvent.click(hamburger());
    fireEvent.click(within(menu).getByRole("button", { name: "Fechar menu" }));
    expect(isOpen()).toBe(false);
  });

  it("clicar no fundo fecha", () => {
    const { hamburger, backdrop, isOpen } = setup();
    fireEvent.click(hamburger());
    fireEvent.click(backdrop() as HTMLElement);
    expect(isOpen()).toBe(false);
    expect(backdrop()).toBeNull();
  });

  it("Escape fecha", () => {
    const { hamburger, isOpen } = setup();
    fireEvent.click(hamburger());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(isOpen()).toBe(false);
  });

  it("escolher um item navega e fecha", () => {
    const { menu, hamburger, isOpen } = setup("/anime");
    fireEvent.click(hamburger());
    const link = within(menu).getByRole("link", { name: "Filmes" });
    fireEvent.click(link);
    expect(isOpen()).toBe(false);
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it("leva o foco para dentro do menu ao abrir e o devolve ao fechar", () => {
    const { menu, hamburger } = setup();
    fireEvent.click(hamburger());
    expect(menu.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(hamburger());
  });

  it("ignora a preferência antiga de menu expandido e não persiste nada", () => {
    localStorage.setItem("sidebar-collapsed", "false");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const { hamburger, isOpen } = setup();
    expect(isOpen()).toBe(false);
    fireEvent.click(hamburger());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(setItem).not.toHaveBeenCalled();
  });
});
