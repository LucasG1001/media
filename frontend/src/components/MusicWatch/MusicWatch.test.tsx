import { describe, it, expect, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup, screen, within } from "@testing-library/react";
import { MusicWatch } from "./MusicWatch";
import type { MusicLibraryEntry } from "../../types/musicLibrary";

// O player de verdade depende da IFrame API do YouTube; aqui ele vira dois
// botões que disparam o que o YouTube dispararia: "terminou" e "começou a tocar".
vi.mock("../YoutubePlayer/YoutubePlayer", () => ({
  YoutubePlayer: ({
    videoId,
    onEnded,
    onPlaying,
  }: {
    videoId: string;
    onEnded?: () => void;
    onPlaying?: () => void;
  }) => (
    <div data-testid="player" data-video={videoId}>
      <button onClick={onEnded}>fim</button>
      <button onClick={onPlaying}>tocando</button>
    </div>
  ),
}));

afterEach(cleanup);

function track(videoId: string, patch: Partial<MusicLibraryEntry> = {}): MusicLibraryEntry {
  return {
    id: `uuid-${videoId}`,
    videoId,
    title: `Música ${videoId}`,
    channelTitle: `Canal ${videoId}`,
    channelThumbnail: null,
    thumbnail: null,
    durationSeconds: 185,
    viewCount: 1500,
    publishedAt: null,
    description: null,
    status: "liked",
    score: 0,
    notes: null,
    lastAccessAt: null,
    ...patch,
  } as MusicLibraryEntry;
}

const LIST = [track("a"), track("b"), track("c"), track("d")];

function handlers() {
  return {
    onSelect: vi.fn(),
    onEdit: vi.fn(),
    onPlayed: vi.fn(),
    onNotesChange: vi.fn(),
    onAutoplayChange: vi.fn(),
  };
}

function setup(props: Partial<Parameters<typeof MusicWatch>[0]> = {}) {
  const callbacks = handlers();
  const view = render(<MusicWatch entry={LIST[1]} tracks={LIST} autoplay {...callbacks} {...props} />);
  return { ...callbacks, view };
}

function rowTitles(): (string | null)[] {
  return within(screen.getByRole("complementary"))
    .getAllByRole("listitem")
    .map((row) => within(row).getByTitle(/^Música \w$/).textContent);
}

describe("MusicWatch", () => {
  it("mostra a música atual no player e os dados dela", () => {
    setup({ entry: track("b", { score: 9 }) });
    expect(screen.getByTestId("player").getAttribute("data-video")).toBe("b");
    expect(screen.getByRole("heading", { name: "Música b" })).toBeTruthy();
    expect(screen.getByTitle("Status e nota").textContent).toContain("9.0");
  });

  it("lista as músicas na ordem recebida, com duração, canal e visualizações", () => {
    setup();
    expect(rowTitles()).toEqual(["Música a", "Música b", "Música c", "Música d"]);
    const first = within(screen.getByRole("complementary")).getAllByRole("listitem")[0];
    expect(first.textContent).toContain("3:05");
    expect(first.textContent).toContain("Canal a");
    expect(first.textContent).toContain("1,5 mil views");
  });

  // A lista é fixa: escolher uma música não a tira do lugar nem reordena o
  // resto — só muda qual está destacada.
  it("mantém a lista igual ao trocar de música e destaca só a atual", () => {
    const { view } = setup();
    const marked = () =>
      within(screen.getByRole("complementary"))
        .getAllByRole("button")
        .filter((button) => button.getAttribute("aria-current") === "true")
        .map((button) => within(button).getByTitle(/^Música \w$/).textContent);
    expect(marked()).toEqual(["Música b"]);

    view.rerender(<MusicWatch entry={LIST[2]} tracks={LIST} autoplay {...handlers()} />);
    expect(rowTitles()).toEqual(["Música a", "Música b", "Música c", "Música d"]);
    expect(marked()).toEqual(["Música c"]);
    expect(screen.getAllByLabelText("Música atual")).toHaveLength(1);
  });

  it("abre a música clicada na lista", () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByTitle("Música d"));
    expect(onSelect).toHaveBeenCalledWith("d");
  });

  it("clicar na música que já está tocando não faz nada", () => {
    const { onSelect } = setup();
    fireEvent.click(within(screen.getByRole("complementary")).getByTitle("Música b"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("ao terminar, toca a seguinte da lista com a reprodução automática ligada", () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByText("fim"));
    expect(onSelect).toHaveBeenCalledWith("c");
  });

  it("depois da última música a reprodução automática volta para a primeira", () => {
    const { onSelect } = setup({ entry: LIST[3] });
    fireEvent.click(screen.getByText("fim"));
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("ao terminar, não troca de música com a reprodução automática desligada", () => {
    const { onSelect } = setup({ autoplay: false });
    fireEvent.click(screen.getByText("fim"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("liga e desliga a reprodução automática", () => {
    const { onAutoplayChange } = setup();
    fireEvent.click(screen.getByLabelText("Reprodução automática"));
    expect(onAutoplayChange).toHaveBeenCalledWith(false);
  });

  it("navega para a próxima e a anterior pelos botões", () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByLabelText("Próxima música"));
    fireEvent.click(screen.getByLabelText("Música anterior"));
    expect(onSelect.mock.calls).toEqual([["c"], ["a"]]);
  });

  it("sozinha na lista, desabilita anterior/próxima", () => {
    setup({ entry: LIST[0], tracks: [LIST[0]] });
    expect(screen.getByLabelText("Próxima música")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Música anterior")).toHaveProperty("disabled", true);
  });

  it("avisa quando a busca ou a aba não deixam nenhuma música na lista", () => {
    setup({ tracks: [] });
    expect(screen.getByText("Nenhuma música nesta lista.")).toBeTruthy();
  });

  it("mostra os controles recebidos acima da lista e abre o modal de status/nota", () => {
    const { onEdit } = setup({ controls: <div>controles da lista</div> });
    expect(within(screen.getByRole("complementary")).getByText("controles da lista")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Status e nota"));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  // A página abre numa música pausada: abrir não é ouvir. O acesso só conta
  // quando o vídeo começa a tocar, e uma vez por música.
  it("só registra acesso quando a música toca, e uma vez por música", () => {
    const { onPlayed, view } = setup();
    expect(onPlayed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("tocando"));
    fireEvent.click(screen.getByText("tocando"));
    expect(onPlayed).toHaveBeenCalledTimes(1);

    view.rerender(<MusicWatch entry={LIST[2]} tracks={LIST} autoplay {...handlers()} onPlayed={onPlayed} />);
    expect(onPlayed).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("tocando"));
    expect(onPlayed).toHaveBeenCalledTimes(2);
  });

  // A tela não é remontada ao trocar de música (é o que mantém o player), então
  // anotação e descrição dependem do id, não da montagem.
  it("troca a anotação ao mudar de música", () => {
    const { view } = setup({ entry: track("a", { notes: "nota da a" }) });
    expect(screen.getByRole("textbox")).toHaveProperty("value", "nota da a");
    view.rerender(
      <MusicWatch entry={track("b", { notes: "nota da b" })} tracks={LIST} autoplay {...handlers()} />
    );
    expect(screen.getByRole("textbox")).toHaveProperty("value", "nota da b");
  });

  it("recolhe a descrição ao mudar de música", () => {
    const { view } = setup({ entry: track("a", { description: "letra" }) });
    fireEvent.click(screen.getByText("Mostrar mais"));
    expect(screen.getByText("Mostrar menos")).toBeTruthy();
    view.rerender(
      <MusicWatch entry={track("b", { description: "outra letra" })} tracks={LIST} autoplay {...handlers()} />
    );
    expect(screen.getByText("Mostrar mais")).toBeTruthy();
  });
});
