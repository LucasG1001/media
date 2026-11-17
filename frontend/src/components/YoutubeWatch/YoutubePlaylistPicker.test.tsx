import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, fireEvent, cleanup, screen, within } from "@testing-library/react";
import { YoutubePlaylistPicker } from "./YoutubePlaylistPicker";
import { YoutubeSelectionBar } from "./YoutubeSelectionBar";
import type { YoutubePlaylist } from "../../types/youtubeLibrary";

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

const PLAYLISTS: YoutubePlaylist[] = [
  { id: "pl-1", name: "Treino", kind: "music", itemIds: ["a", "b"] },
  { id: "pl-2", name: "Foco", kind: "music", itemIds: ["a"] },
  { id: "pl-3", name: "Viagem", kind: "music", itemIds: [] },
];

type Props = Parameters<typeof YoutubePlaylistPicker>[0];

function setup(props: Partial<Props> = {}) {
  const handlers = { onAdd: vi.fn(), onRemove: vi.fn(), onCreate: vi.fn() };
  render(
    <YoutubePlaylistPicker
      label="Playlists"
      buttonClassName="trigger"
      playlists={PLAYLISTS}
      entryIds={["a", "b"]}
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Playlists" }));
  return within(screen.getByRole("dialog", { name: "Playlists" }));
}

describe("YoutubePlaylistPicker — em lote", () => {
  it("começa fechado", () => {
    setup();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Playlists" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("diz quantos dos itens já estão em cada playlist", () => {
    setup();
    const menu = openMenu();
    expect(menu.getByRole("button", { name: /Treino/ }).textContent).toContain("já estão");
    expect(menu.getByRole("button", { name: /Foco/ }).textContent).toContain("1 de 2 já está");
    expect(menu.getByRole("button", { name: "Viagem" })).toBeTruthy();
  });

  it("adiciona à playlist escolhida e fecha", () => {
    const { onAdd } = setup();
    fireEvent.click(openMenu().getByRole("button", { name: /Foco/ }));
    expect(onAdd).toHaveBeenCalledWith("pl-2");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // Em lote o menu só adiciona: playlist que já tem todos não faz nada.
  it("não tira nada de uma playlist que já tem todos os itens", () => {
    const { onAdd, onRemove } = setup();
    const full = openMenu().getByRole("button", { name: /Treino/ });
    expect(full).toHaveProperty("disabled", true);
    fireEvent.click(full);
    expect(onAdd).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("cria uma playlist nova com o nome digitado, sem espaços nas pontas, e fecha", () => {
    const { onCreate } = setup();
    const menu = openMenu();
    fireEvent.change(menu.getByLabelText("Nome da nova playlist"), { target: { value: "  Estrada " } });
    fireEvent.click(menu.getByRole("button", { name: "Criar" }));
    expect(onCreate).toHaveBeenCalledWith("Estrada");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("não cria com nome vazio nem repetido (sem diferenciar maiúsculas)", () => {
    const { onCreate } = setup();
    const menu = openMenu();
    const create = menu.getByRole("button", { name: "Criar" });
    expect(create).toHaveProperty("disabled", true);
    fireEvent.change(menu.getByLabelText("Nome da nova playlist"), { target: { value: "treino" } });
    expect(create).toHaveProperty("disabled", true);
    expect(menu.getByText("Já existe uma playlist com esse nome.")).toBeTruthy();
    fireEvent.submit(menu.getByLabelText("Nome da nova playlist"));
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("avisa quando ainda não há playlist, e deixa criar", () => {
    setup({ playlists: [] });
    const menu = openMenu();
    expect(menu.getByText("Nenhuma playlist ainda.")).toBeTruthy();
    expect(menu.getByLabelText("Nome da nova playlist")).toBeTruthy();
  });

  it("fecha com Escape, clique fora ou pelo próprio botão", () => {
    setup();
    openMenu();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    openMenu();
    fireEvent.click(screen.getByTestId("playlist-overlay"));
    expect(screen.queryByRole("dialog")).toBeNull();

    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "Playlists" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("desabilitado, não abre e explica o motivo", () => {
    setup({ disabled: true, disabledHint: "Sem conexão." });
    const trigger = screen.getByRole("button", { name: "Playlists" });
    expect(trigger).toHaveProperty("disabled", true);
    expect(trigger.getAttribute("title")).toBe("Sem conexão.");
  });
});

describe("YoutubePlaylistPicker — item único", () => {
  it("marca as playlists em que o item está e alterna sem fechar", () => {
    const { onAdd, onRemove } = setup({ single: true, entryIds: ["b"] });
    const menu = openMenu();
    const pressed = menu
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-pressed") === "true")
      .map((button) => button.textContent);
    expect(pressed).toEqual(["✓Treino"]);

    fireEvent.click(menu.getByRole("button", { name: "Treino" }));
    expect(onRemove).toHaveBeenCalledWith("pl-1");
    fireEvent.click(menu.getByRole("button", { name: "Viagem" }));
    expect(onAdd).toHaveBeenCalledWith("pl-3");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("criar mantém o menu aberto e limpa o campo", () => {
    const { onCreate } = setup({ single: true, entryIds: ["b"] });
    const menu = openMenu();
    const input = menu.getByLabelText("Nome da nova playlist");
    fireEvent.change(input, { target: { value: "Estrada" } });
    fireEvent.submit(input);
    expect(onCreate).toHaveBeenCalledWith("Estrada");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(input).toHaveProperty("value", "");
  });
});

describe("YoutubeSelectionBar", () => {
  type BarProps = Parameters<typeof YoutubeSelectionBar>[0];

  function setupBar(props: Partial<BarProps> = {}) {
    const handlers = { onToggleAll: vi.fn(), onCancel: vi.fn(), onAdd: vi.fn(), onCreate: vi.fn() };
    render(
      <YoutubeSelectionBar
        entryIds={["a", "b"]}
        allSelected={false}
        playlists={PLAYLISTS}
        online
        {...handlers}
        {...props}
      />
    );
    return handlers;
  }

  it("conta os marcados e adiciona a seleção à playlist escolhida", () => {
    const { onAdd } = setupBar();
    expect(screen.getByText("2 selecionados")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar à playlist" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Foco/ }));
    expect(onAdd).toHaveBeenCalledWith("pl-2");
  });

  // A barra aparece o modo inteiro: sem nada marcado ela explica o modo, mas não deixa adicionar.
  it("sem nada marcado, pede os itens e trava o botão de adicionar", () => {
    setupBar({ entryIds: [] });
    expect(screen.getByText("Marque os itens")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Adicionar à playlist" })).toHaveProperty("disabled", true);
  });

  it("trava o botão de adicionar sem conexão", () => {
    setupBar({ online: false });
    const add = screen.getByRole("button", { name: "Adicionar à playlist" });
    expect(add).toHaveProperty("disabled", true);
    expect(add.getAttribute("title")).toContain("Sem conexão");
  });

  it("alterna entre selecionar e desmarcar todos, e cancela", () => {
    const { onToggleAll, onCancel } = setupBar();
    fireEvent.click(screen.getByRole("button", { name: "Selecionar todos" }));
    expect(onToggleAll).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar seleção" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    cleanup();
    setupBar({ allSelected: true });
    expect(screen.getByRole("button", { name: "Desmarcar todos" })).toBeTruthy();
  });
});
