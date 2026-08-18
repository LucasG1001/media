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
    expect(screen.queryByLabelText("Próximo item")).toBeNull();
  });

  it("mostra as duas setas no meio da coleção", () => {
    setup({ index: 2, total: 12, onPrev: vi.fn(), onNext: vi.fn() });
    expect(screen.getByLabelText("Item anterior")).toBeTruthy();
    expect(screen.getByLabelText("Próximo item")).toBeTruthy();
  });

  // Sobre o vídeo a seta das pontas some em vez de ficar desabilitada: o que não
  // leva a lugar nenhum não deve ocupar espaço em cima do conteúdo.
  it("omite a seta na ponta da coleção", () => {
    setup({ index: 0, total: 3, onNext: vi.fn() });
    expect(screen.queryByLabelText("Item anterior")).toBeNull();
    expect(screen.getByLabelText("Próximo item")).toBeTruthy();
  });

  it("navega pelos botões", () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    setup({ index: 1, total: 3, onPrev, onNext });
    fireEvent.click(screen.getByLabelText("Próximo item"));
    fireEvent.click(screen.getByLabelText("Item anterior"));
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

// O drawer deixou de ser remontado por vídeo (é o que preserva a tela cheia ao
// navegar), então o que antes vinha da montagem passou a depender do id.
describe("YoutubeDrawer — troca de vídeo sem remontar", () => {
  const outro = { ...entry, id: "uuid-2", videoId: "def456", notes: "nota do outro" } as YoutubeLibraryEntry;

  it("registra acesso a cada vídeo aberto", () => {
    const onOpen = vi.fn();
    const view = render(<YoutubeDrawer entry={entry} onClose={vi.fn()} onOpen={onOpen} />);
    expect(onOpen).toHaveBeenCalledTimes(1);
    view.rerender(<YoutubeDrawer entry={outro} onClose={vi.fn()} onOpen={onOpen} />);
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("não registra acesso de novo em re-render do mesmo vídeo", () => {
    const onOpen = vi.fn();
    const view = render(<YoutubeDrawer entry={entry} onClose={vi.fn()} onOpen={onOpen} />);
    view.rerender(<YoutubeDrawer entry={entry} onClose={vi.fn()} onOpen={onOpen} />);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  // O NotesBlock guarda o texto em estado interno: sem key por vídeo, a anotação
  // de um vazaria para o outro.
  it("troca a anotação ao mudar de vídeo", () => {
    const comNota = { ...entry, notes: "nota do primeiro" } as YoutubeLibraryEntry;
    const view = render(<YoutubeDrawer entry={comNota} onClose={vi.fn()} onNotesChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveProperty("value", "nota do primeiro");
    view.rerender(<YoutubeDrawer entry={outro} onClose={vi.fn()} onNotesChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveProperty("value", "nota do outro");
  });
});
