import { describe, it, expect, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup, screen } from "@testing-library/react";
import { YoutubeListControls } from "./YoutubeListControls";

afterEach(cleanup);

function setup(props: Partial<Parameters<typeof YoutubeListControls>[0]> = {}) {
  const handlers = {
    onStatusChange: vi.fn(),
    onSearchChange: vi.fn(),
    onSortSelect: vi.fn(),
    onGroupByChannelChange: vi.fn(),
  };
  render(
    <YoutubeListControls
      status="liked"
      search=""
      sortField="alpha"
      sortDir="asc"
      groupByChannel={false}
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

describe("YoutubeListControls", () => {
  it("troca a aba de status", () => {
    const { onStatusChange } = setup();
    // O TabNav repete as abas num <select> para o celular; o botão é a aba em si.
    fireEvent.click(screen.getByRole("button", { name: "Removido" }));
    expect(onStatusChange).toHaveBeenCalledWith("removed");
  });

  it("repassa o texto da busca", () => {
    const { onSearchChange } = setup();
    fireEvent.change(screen.getByLabelText("Buscar na biblioteca"), { target: { value: "queen" } });
    expect(onSearchChange).toHaveBeenCalledWith("queen");
  });

  it("mostra o critério ativo e troca para o escolhido", () => {
    const { onSortSelect } = setup({ sortField: "views" });
    const select = screen.getByLabelText("Ordenar por");
    expect(select).toHaveProperty("value", "views");
    fireEvent.change(select, { target: { value: "access" } });
    expect(onSortSelect).toHaveBeenCalledWith("access");
  });

  // Escolher de novo o critério ativo é o que inverte a direção no useSingleSort.
  it("inverte a direção reenviando o critério ativo", () => {
    const { onSortSelect } = setup({ sortField: "date", sortDir: "desc" });
    const button = screen.getByLabelText("Inverter ordem");
    expect(button.getAttribute("title")).toBe("Decrescente");
    fireEvent.click(button);
    expect(onSortSelect).toHaveBeenCalledWith("date");
  });

  it("liga e desliga o agrupamento por canal", () => {
    const { onGroupByChannelChange } = setup();
    const toggle = screen.getByLabelText("Agrupar por canal");
    expect(toggle).toHaveProperty("checked", false);
    fireEvent.click(toggle);
    expect(onGroupByChannelChange).toHaveBeenCalledWith(true);
    cleanup();
    setup({ groupByChannel: true });
    expect(screen.getByLabelText("Agrupar por canal")).toHaveProperty("checked", true);
  });
});
