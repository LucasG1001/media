import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, fireEvent, cleanup, screen, within } from "@testing-library/react";
import { YoutubeWatch } from "./YoutubeWatch";
import type { YoutubeLibraryEntry } from "../../types/youtubeLibrary";
import type { ChannelGroup } from "../../utils/youtubeList";

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

function track(videoId: string, patch: Partial<YoutubeLibraryEntry> = {}): YoutubeLibraryEntry {
  return {
    id: `uuid-${videoId}`,
    videoId,
    title: `Item ${videoId}`,
    channelId: `ch-${videoId}`,
    channelTitle: `Canal ${videoId}`,
    channelThumbnail: null,
    thumbnail: null,
    durationSeconds: 185,
    viewCount: 1500,
    publishedAt: null,
    description: null,
    kind: "music",
    status: "liked",
    score: 0,
    notes: null,
    lastAccessAt: null,
    ...patch,
  } as YoutubeLibraryEntry;
}

const LIST = [track("a"), track("b"), track("c"), track("d")];

function handlers() {
  return {
    onKindChange: vi.fn(),
    onToggleChannel: vi.fn(),
    onSelect: vi.fn(),
    onEdit: vi.fn(),
    onMove: vi.fn(),
    onPlayed: vi.fn(),
    onNotesChange: vi.fn(),
    onAutoplayChange: vi.fn(),
  };
}

type Props = Parameters<typeof YoutubeWatch>[0];

function element(props: Partial<Props> = {}, callbacks = handlers()) {
  return (
    <YoutubeWatch entry={LIST[1]} kind="music" tracks={LIST} playOrder={LIST} autoplay {...callbacks} {...props} />
  );
}

function setup(props: Partial<Props> = {}) {
  const callbacks = handlers();
  const view = render(element(props, callbacks));
  return { ...callbacks, view };
}

function panel() {
  return within(screen.getByRole("complementary"));
}

function rowTitles(): (string | null)[] {
  return panel()
    .getAllByRole("listitem")
    .map((row) => within(row).getByTitle(/^Item \w$/).textContent);
}

function markedTitles(): (string | null)[] {
  return panel()
    .getAllByRole("button")
    .filter((button) => button.getAttribute("aria-current") === "true")
    // O selo ▶ da linha atual também tem título ("Item atual"); o padrão pega só
    // o título do item ou do canal.
    .map((button) => within(button).getByTitle(/^Item [a-d]$|^Canal (Um|Dois)$/).textContent);
}

describe("YoutubeWatch — player e lista", () => {
  it("mostra o item atual no player e os dados dele", () => {
    setup({ entry: track("b", { score: 9 }) });
    expect(screen.getByTestId("player").getAttribute("data-video")).toBe("b");
    expect(screen.getByRole("heading", { name: "Item b" })).toBeTruthy();
    expect(screen.getByTitle("Status e nota").textContent).toContain("9.0");
  });

  it("lista os itens na ordem recebida, com duração, canal e visualizações", () => {
    setup();
    expect(rowTitles()).toEqual(["Item a", "Item b", "Item c", "Item d"]);
    const first = panel().getAllByRole("listitem")[0];
    expect(first.textContent).toContain("3:05");
    expect(first.textContent).toContain("Canal a");
    expect(first.textContent).toContain("1,5 mil views");
  });

  it("mostra no cabeçalho quantos itens a lista tem", () => {
    setup();
    expect(panel().getByText("4 músicas")).toBeTruthy();
    cleanup();
    setup({ kind: "video", tracks: [LIST[0]], playOrder: [LIST[0]] });
    expect(panel().getByText("1 vídeo")).toBeTruthy();
  });

  // A lista é fixa: escolher um item não o tira do lugar nem reordena o resto —
  // só muda qual está destacado.
  it("mantém a lista igual ao trocar de item e destaca só o atual", () => {
    const { view } = setup();
    expect(markedTitles()).toEqual(["Item b"]);
    view.rerender(element({ entry: LIST[2] }));
    expect(rowTitles()).toEqual(["Item a", "Item b", "Item c", "Item d"]);
    expect(markedTitles()).toEqual(["Item c"]);
    expect(screen.getAllByLabelText("Item atual")).toHaveLength(1);
  });

  it("abre o item clicado na lista", () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByTitle("Item d"));
    expect(onSelect).toHaveBeenCalledWith("d");
  });

  it("clicar no item que já está tocando não faz nada", () => {
    const { onSelect } = setup();
    fireEvent.click(panel().getByTitle("Item b"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("avisa quando a lista está vazia, com o nome do tipo da aba", () => {
    setup({ tracks: [] });
    expect(screen.getByText("Nenhuma música nesta lista.")).toBeTruthy();
    cleanup();
    setup({ tracks: [], kind: "video" });
    expect(screen.getByText("Nenhum vídeo nesta lista.")).toBeTruthy();
  });

  it("mostra os controles recebidos acima da lista e abre o modal de status/nota", () => {
    const { onEdit } = setup({ controls: <div>controles da lista</div> });
    expect(panel().getByText("controles da lista")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Status e nota"));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

describe("YoutubeWatch — abas de músicas e vídeos", () => {
  it("marca a aba do tipo ativo e troca para a outra", () => {
    const { onKindChange } = setup();
    fireEvent.click(panel().getByRole("button", { name: "Vídeos" }));
    expect(onKindChange).toHaveBeenCalledWith("video");
  });

  // O botão fica em cada linha para mover sem precisar abrir o item.
  it("manda um item da lista para a outra aba pelo botão da linha", () => {
    const { onMove, onSelect } = setup();
    fireEvent.click(screen.getByLabelText("Mover para Vídeos: Item c"));
    expect(onMove).toHaveBeenCalledWith(LIST[2]);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("o destino do botão segue o tipo do item, não a aba", () => {
    setup({ tracks: [track("v", { kind: "video" })], kind: "video" });
    expect(screen.getByLabelText("Mover para Músicas: Item v")).toBeTruthy();
  });

  it("manda o item que está tocando para a outra aba pelo botão abaixo do player", () => {
    const { onMove } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Mover para Vídeos" }));
    expect(onMove).toHaveBeenCalledWith(LIST[1]);
  });
});

describe("YoutubeWatch — reprodução", () => {
  it("ao terminar, toca o seguinte da ordem de reprodução com a reprodução automática ligada", () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByText("fim"));
    expect(onSelect).toHaveBeenCalledWith("c");
  });

  it("depois do último item a reprodução automática volta para o primeiro", () => {
    const { onSelect } = setup({ entry: LIST[3] });
    fireEvent.click(screen.getByText("fim"));
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("ao terminar, não troca de item com a reprodução automática desligada", () => {
    const { onSelect } = setup({ autoplay: false });
    fireEvent.click(screen.getByText("fim"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  // O interruptor fica com anterior/próximo, abaixo do player — não no painel.
  it("liga e desliga a reprodução automática", () => {
    const { onAutoplayChange } = setup();
    const toggle = screen.getByRole("button", { name: "Reprodução automática" });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(panel().queryByRole("button", { name: "Reprodução automática" })).toBeNull();
    fireEvent.click(toggle);
    expect(onAutoplayChange).toHaveBeenCalledWith(false);
    cleanup();
    const off = setup({ autoplay: false });
    fireEvent.click(screen.getByRole("button", { name: "Reprodução automática" }));
    expect(off.onAutoplayChange).toHaveBeenCalledWith(true);
  });

  it("navega para o próximo e o anterior pelos botões", () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByLabelText("Próximo item"));
    fireEvent.click(screen.getByLabelText("Item anterior"));
    expect(onSelect.mock.calls).toEqual([["c"], ["a"]]);
  });

  // Agrupada por canal a lista mostra os canais, e a reprodução anda por todos
  // os itens na ordem deles.
  it("segue a ordem de reprodução recebida, não as linhas mostradas", () => {
    const { onSelect } = setup({ tracks: [LIST[1]], playOrder: [LIST[1], LIST[3]] });
    fireEvent.click(screen.getByLabelText("Próximo item"));
    expect(onSelect).toHaveBeenCalledWith("d");
  });

  it("sozinho na ordem de reprodução, desabilita anterior/próximo", () => {
    setup({ entry: LIST[0], tracks: [LIST[0]], playOrder: [LIST[0]] });
    expect(screen.getByLabelText("Próximo item")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Item anterior")).toHaveProperty("disabled", true);
  });

  // A página abre num item pausado: abrir não é assistir. O acesso só conta
  // quando o vídeo começa a tocar, e uma vez por item.
  it("só registra acesso quando o item toca, e uma vez por item", () => {
    const { onPlayed, view } = setup();
    expect(onPlayed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("tocando"));
    fireEvent.click(screen.getByText("tocando"));
    expect(onPlayed).toHaveBeenCalledTimes(1);

    view.rerender(element({ entry: LIST[2], onPlayed }));
    expect(onPlayed).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("tocando"));
    expect(onPlayed).toHaveBeenCalledTimes(2);
  });
});

describe("YoutubeWatch — agrupado por canal", () => {
  const channels: ChannelGroup[] = [
    { key: "ch-1", name: "Canal Um", thumbnail: null, tracks: [LIST[0], LIST[1]] },
    { key: "ch-2", name: "Canal Dois", thumbnail: null, tracks: [LIST[2]] },
  ];

  it("mostra os canais no lugar dos itens, com a contagem de cada um", () => {
    setup({ channels, playOrder: LIST.slice(0, 3) });
    const rows = panel().getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    // O cabeçalho soma os itens de todos os canais.
    expect(panel().getByText("3 músicas")).toBeTruthy();
    expect(within(rows[0]).getByTitle("Canal Um")).toBeTruthy();
    expect(rows[0].textContent).toContain("2 músicas");
    expect(within(rows[1]).getByTitle("Canal Dois")).toBeTruthy();
    expect(rows[1].textContent).toContain("1 música");
    expect(screen.queryByTitle("Item a")).toBeNull();
  });

  it("conta em vídeos na aba de vídeos", () => {
    setup({ channels, kind: "video" });
    expect(panel().getAllByRole("listitem")[0].textContent).toContain("2 vídeos");
  });

  it("abre o canal clicado, e fecha clicando de novo", () => {
    const { onToggleChannel, onSelect } = setup({ channels });
    const row = screen.getByTitle("Canal Dois").closest("button")!;
    expect(row.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(row);
    expect(onToggleChannel).toHaveBeenCalledWith("ch-2");
    expect(onSelect).not.toHaveBeenCalled();
    cleanup();

    const open = setup({ channels, openChannels: new Set(["ch-2"]) });
    const openRow = screen.getByTitle("Canal Dois").closest("button")!;
    expect(openRow.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(openRow);
    expect(open.onToggleChannel).toHaveBeenCalledWith("ch-2");
  });

  // O item atual é o "b", do Canal Um.
  it("destaca o canal do item que está tocando", () => {
    setup({ channels });
    expect(markedTitles()).toEqual(["Canal Um"]);
  });

  // Sanfona: os itens entram abaixo do canal, e os outros canais ficam onde estão.
  it("com um canal aberto mostra os itens dele logo abaixo, sem tirar os outros canais", () => {
    const { onSelect } = setup({ channels, openChannels: new Set(["ch-1"]), playOrder: LIST.slice(0, 3) });
    const inner = within(panel().getByRole("list", { name: "Canal Um" }));
    expect(inner.getAllByRole("listitem").map((row) => within(row).getByTitle(/^Item \w$/).textContent)).toEqual([
      "Item a",
      "Item b",
    ]);
    expect(panel().getByTitle("Canal Dois")).toBeTruthy();
    expect(screen.queryByTitle("Item c")).toBeNull();
    // Aberto, o destaque é do item dentro dele, não da linha do canal.
    expect(markedTitles()).toEqual(["Item b"]);

    fireEvent.click(inner.getByTitle("Item a"));
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("vários canais podem estar abertos ao mesmo tempo", () => {
    setup({ channels, openChannels: new Set(["ch-1", "ch-2"]) });
    expect(panel().getByRole("list", { name: "Canal Um" })).toBeTruthy();
    expect(within(panel().getByRole("list", { name: "Canal Dois" })).getByTitle("Item c")).toBeTruthy();
  });

  it("avisa quando nenhum canal passa pelo filtro", () => {
    setup({ channels: [] });
    expect(screen.getByText("Nenhuma música nesta lista.")).toBeTruthy();
  });
});

// A tela não é remontada ao trocar de item (é o que mantém o player), então
// anotação e descrição dependem do id, não da montagem.
describe("YoutubeWatch — troca de item sem remontar", () => {
  it("troca a anotação ao mudar de item", () => {
    const { view } = setup({ entry: track("a", { notes: "nota do a" }) });
    expect(screen.getByRole("textbox")).toHaveProperty("value", "nota do a");
    view.rerender(element({ entry: track("b", { notes: "nota do b" }) }));
    expect(screen.getByRole("textbox")).toHaveProperty("value", "nota do b");
  });

  it("recolhe a descrição ao mudar de item", () => {
    const { view } = setup({ entry: track("a", { description: "letra" }) });
    fireEvent.click(screen.getByText("Mostrar mais"));
    expect(screen.getByText("Mostrar menos")).toBeTruthy();
    view.rerender(element({ entry: track("b", { description: "outra letra" }) }));
    expect(screen.getByText("Mostrar mais")).toBeTruthy();
  });
});

describe("YoutubeWatch — celular", () => {
  // O CSS é quem esconde descrição e anotação no celular; o botão guarda o estado.
  it("o botão de detalhes começa fechado e alterna, sem voltar ao trocar de item", () => {
    const { view } = setup();
    const toggle = screen.getByRole("button", { name: "Mostrar detalhes" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Ocultar detalhes" }).getAttribute("aria-expanded")).toBe("true");

    view.rerender(element({ entry: LIST[2] }));
    expect(screen.getByRole("button", { name: "Ocultar detalhes" })).toBeTruthy();
  });

  // Recolhida, a anotação continua montada: texto digitado não se perde.
  it("a anotação fica montada com os detalhes fechados", () => {
    setup({ entry: track("a", { notes: "nota do a" }) });
    expect(screen.getByRole("button", { name: "Mostrar detalhes" })).toBeTruthy();
    expect(screen.getByRole("textbox")).toHaveProperty("value", "nota do a");
  });

  describe("rolagem ao escolher", () => {
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;
    let playerTop = 0;

    beforeEach(() => {
      scrollIntoView.mockReset();
      Element.prototype.scrollIntoView = scrollIntoView;
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
        () => ({ top: playerTop, bottom: playerTop, left: 0, right: 0, width: 0, height: 0, x: 0, y: playerTop }) as DOMRect
      );
    });

    afterEach(() => {
      Element.prototype.scrollIntoView = original;
      vi.restoreAllMocks();
    });

    // Player fixo: está sempre no topo, então escolher não mexe na rolagem.
    it("com o player à vista não rola a página", () => {
      playerTop = 0;
      const { view } = setup();
      view.rerender(element({ entry: LIST[2] }));
      expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it("com o player fora da vista traz a tela de volta até ele", () => {
      playerTop = -300;
      const { view } = setup();
      scrollIntoView.mockClear();
      view.rerender(element({ entry: LIST[2] }));
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    });
  });
});
