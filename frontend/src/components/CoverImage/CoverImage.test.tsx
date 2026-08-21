import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CoverImage } from "./CoverImage";

const TMDB = "https://image.tmdb.org/t/p/w500/a.jpg";

describe("CoverImage", () => {
  afterEach(cleanup);

  it("renders the proxied URL", () => {
    render(<CoverImage src={TMDB} alt="capa" />);
    expect(screen.getByAltText("capa").getAttribute("src")).toBe(
      "/api/img?u=https%3A%2F%2Fimage.tmdb.org%2Ft%2Fp%2Fw500%2Fa.jpg"
    );
  });

  it("shows the fallback when there is no source", () => {
    render(<CoverImage src={null} alt="capa" fallback={<div>vazio</div>} />);
    expect(screen.getByText("vazio")).toBeTruthy();
    expect(screen.queryByAltText("capa")).toBeNull();
  });

  it("falls back to the placeholder when the image fails to load", () => {
    render(<CoverImage src={TMDB} alt="capa" fallback={<div>vazio</div>} />);
    fireEvent.error(screen.getByAltText("capa"));
    expect(screen.getByText("vazio")).toBeTruthy();
    expect(screen.queryByAltText("capa")).toBeNull();
  });

  it("recovers when the source changes after a failure", () => {
    const { rerender } = render(<CoverImage src={TMDB} alt="capa" fallback={<div>vazio</div>} />);
    fireEvent.error(screen.getByAltText("capa"));

    rerender(<CoverImage src="https://image.tmdb.org/t/p/w500/b.jpg" alt="capa" fallback={<div>vazio</div>} />);
    expect(screen.getByAltText("capa")).toBeTruthy();
  });
});
