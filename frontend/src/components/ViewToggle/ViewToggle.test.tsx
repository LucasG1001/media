import { describe, it, expect, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup, screen, within } from "@testing-library/react";
import { ViewToggle, GridViewIcon, DetailViewIcon } from "./ViewToggle";

afterEach(cleanup);

const OPTIONS = [
  { id: "grid" as const, label: "Grade", icon: <GridViewIcon /> },
  { id: "watch" as const, label: "Detalhe", icon: <DetailViewIcon /> },
];

describe("ViewToggle", () => {
  it("marca a opção ativa e avisa a escolhida", () => {
    const onChange = vi.fn();
    render(<ViewToggle label="Visualização da biblioteca" options={OPTIONS} value="grid" onChange={onChange} />);
    const group = within(screen.getByRole("group", { name: "Visualização da biblioteca" }));
    expect(group.getByRole("button", { name: "Grade" }).getAttribute("aria-pressed")).toBe("true");
    const detail = group.getByRole("button", { name: "Detalhe" });
    expect(detail.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(detail);
    expect(onChange).toHaveBeenCalledWith("watch");
  });
});
