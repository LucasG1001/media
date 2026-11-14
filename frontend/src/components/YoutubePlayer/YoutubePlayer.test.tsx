import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, screen, act } from "@testing-library/react";
import { YoutubePlayer } from "./YoutubePlayer";
import type { YoutubePlayerOptions } from "../../utils/youtubeIframeApi";

// Dublê da IFrame API: guarda as opções com que o player foi criado para os
// testes dispararem os eventos que o YouTube dispararia.
let created: YoutubePlayerOptions[] = [];
const loadVideoById = vi.fn();
const destroy = vi.fn();

class FakePlayer {
  constructor(_element: HTMLElement, options: YoutubePlayerOptions) {
    created.push(options);
  }
  loadVideoById = loadVideoById;
  destroy = destroy;
}

beforeEach(() => {
  created = [];
  loadVideoById.mockClear();
  destroy.mockClear();
  window.YT = { Player: FakePlayer };
});

afterEach(() => {
  cleanup();
  delete window.YT;
});

// A API é resolvida por promise, então o player nasce depois do primeiro render.
async function mount(videoId: string, onEnded?: () => void, onPlaying?: () => void) {
  const view = render(<YoutubePlayer videoId={videoId} onEnded={onEnded} onPlaying={onPlaying} />);
  await act(async () => {});
  return view;
}

describe("YoutubePlayer", () => {
  // A página abre na última música sem ninguém ter pedido para tocar.
  it("cria o player uma vez, com o vídeo pedido, pausado e com controles nativos", async () => {
    await mount("abc");
    expect(created).toHaveLength(1);
    expect(created[0].videoId).toBe("abc");
    expect(created[0].playerVars).toMatchObject({ autoplay: 0 });
    // Tela cheia é a nativa do player: `fs` não pode ser desligado aqui.
    expect(created[0].playerVars).not.toHaveProperty("fs");
  });

  // Recriar o player derrubaria a tela cheia a cada música.
  it("troca de vídeo no mesmo player em vez de recriá-lo", async () => {
    const view = await mount("abc");
    act(() => created[0].events?.onReady?.());
    view.rerender(<YoutubePlayer videoId="def" />);
    expect(created).toHaveLength(1);
    expect(loadVideoById).toHaveBeenCalledWith("def");
    expect(destroy).not.toHaveBeenCalled();
  });

  it("carrega o vídeo mais recente se a troca veio antes de o player ficar pronto", async () => {
    const view = await mount("abc");
    view.rerender(<YoutubePlayer videoId="def" />);
    expect(loadVideoById).not.toHaveBeenCalled();
    act(() => created[0].events?.onReady?.());
    expect(loadVideoById).toHaveBeenCalledWith("def");
  });

  it("avisa quando o vídeo termina, e só então", async () => {
    const onEnded = vi.fn();
    await mount("abc", onEnded);
    act(() => created[0].events?.onStateChange?.({ data: 1 }));
    expect(onEnded).not.toHaveBeenCalled();
    act(() => created[0].events?.onStateChange?.({ data: 0 }));
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it("avisa quando o vídeo começa a tocar", async () => {
    const onPlaying = vi.fn();
    await mount("abc", undefined, onPlaying);
    expect(onPlaying).not.toHaveBeenCalled();
    act(() => created[0].events?.onStateChange?.({ data: 1 }));
    expect(onPlaying).toHaveBeenCalledTimes(1);
  });

  it("não mostra a tela de indisponível enquanto o vídeo toca", async () => {
    await mount("abc");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("mostra 'Abrir no YouTube' quando o dono bloqueia a reprodução embutida", async () => {
    await mount("abc");
    act(() => created[0].events?.onError?.({ data: 150 }));
    expect(screen.getByRole("alert").textContent).toContain("não pode ser reproduzido fora do YouTube");
    const link = screen.getByRole("link", { name: /Abrir no YouTube/ });
    expect(link.getAttribute("href")).toBe("https://www.youtube.com/watch?v=abc");
  });

  it("diz que o vídeo foi removido quando é esse o erro", async () => {
    await mount("abc");
    act(() => created[0].events?.onError?.({ data: 100 }));
    expect(screen.getByRole("alert").textContent).toContain("removido ou está privado");
  });

  // O bloqueio é do vídeo, não do player: a música seguinte tem que tocar.
  it("some com a tela de indisponível ao trocar de vídeo", async () => {
    const view = await mount("abc");
    act(() => created[0].events?.onReady?.());
    act(() => created[0].events?.onError?.({ data: 150 }));
    view.rerender(<YoutubePlayer videoId="def" />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("destrói o player ao desmontar", async () => {
    const view = await mount("abc");
    view.unmount();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
