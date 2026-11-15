import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, fireEvent, cleanup, screen } from "@testing-library/react";
import { LibraryControls } from "./LibraryControls";

type Props = Parameters<typeof LibraryControls>[0];

function setup(props: Partial<Props> = {}) {
  const onSelect = vi.fn();
  const onSearchChange = vi.fn();
  render(
    <LibraryControls
      searchValue=""
      onSearchChange={onSearchChange}
      count={3}
      filterGroups={[
        {
          key: "status",
          title: "Status",
          options: [{ value: "watched", label: "Assistido" }],
          selected: [],
          onToggle: vi.fn(),
        },
      ]}
      onClearFilters={vi.fn()}
      sort={{
        active: "release",
        dir: "desc",
        options: [
          { field: "release", label: "Lançamento" },
          { field: "score", label: "Nota" },
        ],
        onSelect,
      }}
      trailing={<button type="button">Grade</button>}
      {...props}
    />
  );
  return { onSelect, onSearchChange };
}

beforeEach(() => {
  // jsdom não implementa matchMedia, que o useDismiss consulta ao abrir um painel.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

afterEach(cleanup);

describe("LibraryControls", () => {
  it("na barra normal os gatilhos têm rótulo e a contagem aparece", () => {
    setup();
    expect(screen.getByText("Filtros")).toBeTruthy();
    expect(screen.getByText("resultados", { exact: false })).toBeTruthy();
    expect(screen.getByTitle(/^Inverter ordem/)).toBeTruthy();
  });

  it("o ícone da ordenação inverte a direção reescolhendo o critério ativo", () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByTitle(/^Inverter ordem/));
    expect(onSelect).toHaveBeenCalledWith("release");
  });
});

describe("LibraryControls — compacta", () => {
  it("Filtros e Ordenação viram botões de ícone, com o nome só para leitor de tela", () => {
    setup({ compact: true });
    expect(screen.getByRole("button", { name: "Filtros" })).toBeTruthy();
    expect(screen.queryByText("Filtros")).toBeNull();
    expect(screen.getByRole("button", { name: "Ordenação: Lançamento" })).toBeTruthy();
  });

  it("não mostra a contagem nem o botão separado de inverter a ordem", () => {
    setup({ compact: true });
    expect(screen.queryByText("resultados", { exact: false })).toBeNull();
    expect(screen.queryByTitle(/^Inverter ordem/)).toBeNull();
  });

  it("mantém a busca, o controle extra da página e as opções de ordenação", () => {
    const { onSelect, onSearchChange } = setup({ compact: true });
    fireEvent.change(screen.getByPlaceholderText("Buscar na biblioteca..."), { target: { value: "zelda" } });
    expect(onSearchChange).toHaveBeenCalledWith("zelda");
    expect(screen.getByRole("button", { name: "Grade" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ordenação: Lançamento" }));
    fireEvent.click(screen.getByRole("button", { name: "Nota" }));
    expect(onSelect).toHaveBeenCalledWith("score");
  });
});
