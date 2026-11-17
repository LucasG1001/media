import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, fireEvent, cleanup, screen, within } from "@testing-library/react";
import { YoutubeListControls } from "./YoutubeListControls";

beforeEach(() => {
  // jsdom não implementa matchMedia, que o useDismiss consulta ao abrir o menu.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

afterEach(cleanup);

function setup(props: Partial<Parameters<typeof YoutubeListControls>[0]> = {}) {
  const handlers = {
    onStatusChange: vi.fn(),
    onSearchChange: vi.fn(),
    onSortSelect: vi.fn(),
    onGroupByChannelChange: vi.fn(),
    onShowPlaylistsChange: vi.fn(),
    onSelectingChange: vi.fn(),
  };
  render(
    <YoutubeListControls
      status="liked"
      search=""
      sortField="alpha"
      sortDir="asc"
      groupByChannel={false}
      showPlaylists={false}
      selecting={false}
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

function openSortMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Ordenar" }));
  return within(screen.getByRole("menu"));
}

describe("YoutubeListControls", () => {
  it("repassa o texto da busca", () => {
    const { onSearchChange } = setup();
    fireEvent.change(screen.getByLabelText("Buscar na biblioteca"), { target: { value: "queen" } });
    expect(onSearchChange).toHaveBeenCalledWith("queen");
  });

  // Removidos é raro: em vez de uma linha de abas, um botão que alterna.
  it("alterna entre curtidos e removidos pelo botão", () => {
    const { onStatusChange } = setup();
    const toggle = screen.getByRole("button", { name: "Mostrar removidos" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(onStatusChange).toHaveBeenCalledWith("removed");
    cleanup();
    const shown = setup({ status: "removed" });
    const pressed = screen.getByRole("button", { name: "Mostrar removidos" });
    expect(pressed.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(pressed);
    expect(shown.onStatusChange).toHaveBeenCalledWith("liked");
  });

  it("o menu de ordenação começa fechado e resume o critério ativo no botão", () => {
    setup({ sortField: "views", sortDir: "desc" });
    const button = screen.getByRole("button", { name: "Ordenar" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("title")).toBe("Ordenar: Visualizações, decrescente");
  });

  it("mostra os critérios, marca o ativo com a direção e troca para o escolhido", () => {
    const { onSortSelect } = setup({ sortField: "views", sortDir: "desc" });
    const menu = openSortMenu();
    const options = menu.getAllByRole("menuitemradio");
    expect(options.map((option) => option.getAttribute("aria-checked"))).toEqual(["false", "false", "true", "false"]);
    expect(menu.getByRole("menuitemradio", { name: /Visualizações/ }).textContent).toContain("↓");
    fireEvent.click(menu.getByRole("menuitemradio", { name: "Último acesso" }));
    expect(onSortSelect).toHaveBeenCalledWith("access");
  });

  // Escolher de novo o critério ativo é o que inverte a direção no useSingleSort;
  // por isso o menu continua aberto depois de uma escolha.
  it("inverte a direção reenviando o critério ativo, sem fechar o menu", () => {
    const { onSortSelect } = setup({ sortField: "date", sortDir: "asc" });
    const menu = openSortMenu();
    const active = menu.getByRole("menuitemradio", { name: /Data/ });
    expect(active.textContent).toContain("↑");
    fireEvent.click(active);
    expect(onSortSelect).toHaveBeenCalledWith("date");
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("fecha o menu de ordenação com Escape, clique fora ou pelo próprio botão", () => {
    setup();
    openSortMenu();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();

    openSortMenu();
    fireEvent.click(screen.getByTestId("sort-overlay"));
    expect(screen.queryByRole("menu")).toBeNull();

    openSortMenu();
    fireEvent.click(screen.getByRole("button", { name: "Ordenar" }));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("liga e desliga o agrupamento por canal", () => {
    const { onGroupByChannelChange } = setup();
    const toggle = screen.getByRole("button", { name: "Agrupar por canal" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(onGroupByChannelChange).toHaveBeenCalledWith(true);
    cleanup();
    const grouped = setup({ groupByChannel: true });
    const pressed = screen.getByRole("button", { name: "Agrupar por canal" });
    expect(pressed.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(pressed);
    expect(grouped.onGroupByChannelChange).toHaveBeenCalledWith(false);
  });

  // O bloco de playlists é independente do agrupamento por canal.
  it("liga e desliga o bloco de playlists sem mexer no agrupamento", () => {
    const { onShowPlaylistsChange, onGroupByChannelChange } = setup();
    const toggle = screen.getByRole("button", { name: "Mostrar playlists" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(onShowPlaylistsChange).toHaveBeenCalledWith(true);
    expect(onGroupByChannelChange).not.toHaveBeenCalled();
    cleanup();
    const shown = setup({ showPlaylists: true });
    const pressed = screen.getByRole("button", { name: "Mostrar playlists" });
    expect(pressed.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(pressed);
    expect(shown.onShowPlaylistsChange).toHaveBeenCalledWith(false);
  });

  it("entra e sai do modo de seleção", () => {
    const { onSelectingChange } = setup();
    const toggle = screen.getByRole("button", { name: "Selecionar vários" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(onSelectingChange).toHaveBeenCalledWith(true);
    cleanup();
    const selecting = setup({ selecting: true });
    const pressed = screen.getByRole("button", { name: "Selecionar vários" });
    expect(pressed.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(pressed);
    expect(selecting.onSelectingChange).toHaveBeenCalledWith(false);
  });
});
