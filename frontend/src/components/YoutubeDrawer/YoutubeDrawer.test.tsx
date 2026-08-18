import { describe, it, expect, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup, screen } from "@testing-library/react";
import { YoutubeDrawer } from "./YoutubeDrawer";
import type { YoutubeLibraryEntry } from "../../types/youtubeLibrary";

// O projeto não usa os globals do vitest, então a limpeza automática do
// testing-library não roda e os renders se acumulariam entre os testes.
afterEach(cleanup);

const entry = {
  id: "uuid-1",
  videoId: "abc123",
  title: "Vídeo",
  channelTitle: "Canal",
  thumbnail: null,
  channelThumbnail: null,
  status: "liked",
  durationSeconds: 120,
  viewCount: 10,
  publishedAt: null,
  collectionId: 1,
  tags: [],
  notes: null,
  lastAccessAt: null,
} as unknown as YoutubeLibraryEntry;

function setup(nav?: { index: number; total: number; onPrev?: () => void; onNext?: () => void }) {
  const onClose = vi.fn();
  render(<YoutubeDrawer entry={entry} onClose={onClose} nav={nav} />);
  return { onClose };
}

describe("YoutubeDrawer — navegação na coleção", () => {
  it("não mostra navegação sem nav (vídeo avulso)", () => {
    setup();
    expect(screen.queryByLabelText("Próximo vídeo")).toBeNull();
  });

  it("mostra a posição na coleção", () => {
    setup({ index: 2, total: 12, onPrev: vi.fn(), onNext: vi.fn() });
    expect(screen.getByText("3 / 12")).toBeTruthy();
  });

  it("desabilita as pontas", () => {
    setup({ index: 0, total: 3, onNext: vi.fn() });
    expect(screen.getByLabelText("Vídeo anterior")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Próximo vídeo")).toHaveProperty("disabled", false);
  });

  it("navega pelos botões", () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    setup({ index: 1, total: 3, onPrev, onNext });
    fireEvent.click(screen.getByLabelText("Próximo vídeo"));
    fireEvent.click(screen.getByLabelText("Vídeo anterior"));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("navega pelas setas do teclado", () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    setup({ index: 1, total: 3, onPrev, onNext });
    fireEvent.keyDown(document, { key: "ArrowRight" });
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  // O bloco de anotação é uma textarea: ali a seta move o cursor.
  it("não navega com a seta enquanto se digita", () => {
    const onNext = vi.fn();
    setup({ index: 1, total: 3, onNext });
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    fireEvent.keyDown(textarea, { key: "ArrowRight" });
    expect(onNext).not.toHaveBeenCalled();
    textarea.remove();
  });

  it("Escape fecha mesmo digitando", () => {
    const { onClose } = setup({ index: 1, total: 3, onNext: vi.fn() });
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    fireEvent.keyDown(textarea, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    textarea.remove();
  });
});
