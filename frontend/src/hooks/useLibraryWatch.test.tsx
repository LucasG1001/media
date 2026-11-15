import { describe, it, expect, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useLibraryWatch } from "./useLibraryWatch";
import type { CollectionGroup } from "../utils/buildCollectionGroups";

interface Item {
  id: string;
}

function group(key: string, ids: string[]): CollectionGroup<Item> {
  const members = ids.map((id) => ({ id }));
  return { key, representative: members[0], members, count: members.length, completedCount: members.length };
}

// Uma coleção de três e um avulso.
const SAGA = group("saga", ["a", "b", "c"]);
const SINGLE = group("avulso", ["z"]);
const GROUPS = [SAGA, SINGLE];
const KEY = "test-library-view";
// A biblioteca inteira, fora do recorte do filtro.
const LIBRARY = GROUPS.flatMap((g) => g.members);
const findInLibrary = (id: string) => LIBRARY.find((item) => item.id === id);

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function setup(groups = GROUPS, active = true, find: (id: string) => Item | undefined = findInLibrary) {
  return renderHook(({ g, a, f }) => useLibraryWatch(KEY, g, a, f), {
    initialProps: { g: groups, a: active, f: find },
  });
}

describe("useLibraryWatch", () => {
  it("começa na grade, sem item no palco", () => {
    const { result } = setup();
    expect(result.current.view).toBe("grid");
    expect(result.current.entry).toBeUndefined();
  });

  it("lembra a visão escolhida e abre no primeiro item da lista, sem tocar o trailer", () => {
    const first = setup();
    act(() => first.result.current.changeView("watch"));
    expect(localStorage.getItem(KEY)).toBe("watch");
    expect(first.result.current.entry).toBe(SAGA.members[0]);
    expect(first.result.current.props.autoPlay).toBe(false);

    const again = setup();
    expect(again.result.current.view).toBe("watch");
  });

  it("fora da aba da biblioteca não há item no palco", () => {
    localStorage.setItem(KEY, "watch");
    const { result } = setup(GROUPS, false);
    expect(result.current.entry).toBeUndefined();
  });

  it("sem coleção para mostrar não há item no palco", () => {
    localStorage.setItem(KEY, "watch");
    const { result } = setup([]);
    expect(result.current.entry).toBeUndefined();
  });

  it("escolher um item o põe no palco e arma o trailer", () => {
    localStorage.setItem(KEY, "watch");
    const { result } = setup();
    act(() => result.current.props.onSelect(SINGLE.members[0]));
    expect(result.current.entry).toBe(SINGLE.members[0]);
    expect(result.current.props.autoPlay).toBe(true);
  });

  // Voltar para a tela não é pedir o trailer de novo.
  it("trocar de aba ou de visão desarma o trailer, mantendo a escolha", () => {
    localStorage.setItem(KEY, "watch");
    const { result } = setup();
    act(() => result.current.props.onSelect(SAGA.members[1]));
    act(() => result.current.disarm());
    expect(result.current.props.autoPlay).toBe(false);
    expect(result.current.entry).toBe(SAGA.members[1]);

    act(() => result.current.props.onSelect(SAGA.members[2]));
    act(() => result.current.changeView("grid"));
    act(() => result.current.changeView("watch"));
    expect(result.current.props.autoPlay).toBe(false);
    expect(result.current.entry).toBe(SAGA.members[2]);
  });

  // O filtro pode tirar a coleção do escolhido de vista: cai no primeiro da
  // lista, e esse ninguém escolheu.
  it("quando o escolhido sai de vista, cai no primeiro da lista sem tocar o trailer", () => {
    localStorage.setItem(KEY, "watch");
    const { result, rerender } = setup();
    act(() => result.current.props.onSelect(SINGLE.members[0]));
    rerender({ g: [SAGA], a: true, f: findInLibrary });
    expect(result.current.entry).toBe(SAGA.members[0]);
    expect(result.current.props.autoPlay).toBe(false);
  });

  // Os filtros ficam no painel da lista: cair na grade tiraria o campo de busca
  // do lugar no meio da digitação.
  it("filtro sem resultado mantém no palco o último item, lido da biblioteca inteira", () => {
    localStorage.setItem(KEY, "watch");
    const { result, rerender } = setup();
    act(() => result.current.props.onSelect(SAGA.members[1]));

    const edited = { id: "b" };
    rerender({ g: [], a: true, f: (id) => (id === "b" ? edited : undefined) });
    expect(result.current.entry).toBe(edited);
    expect(result.current.props.autoPlay).toBe(true);

    rerender({ g: [SINGLE], a: true, f: findInLibrary });
    expect(result.current.entry).toBe(SINGLE.members[0]);
  });

  it("filtro sem resultado e o último item removido da biblioteca: não há item no palco", () => {
    localStorage.setItem(KEY, "watch");
    const { result, rerender } = setup();
    expect(result.current.entry).toBe(SAGA.members[0]);
    rerender({ g: [], a: true, f: () => undefined });
    expect(result.current.entry).toBeUndefined();
  });

  it("o último item não volta ao palco fora da aba da biblioteca nem na grade", () => {
    localStorage.setItem(KEY, "watch");
    const { result, rerender } = setup();
    expect(result.current.entry).toBe(SAGA.members[0]);
    rerender({ g: [], a: false, f: findInLibrary });
    expect(result.current.entry).toBeUndefined();

    rerender({ g: [], a: true, f: findInLibrary });
    act(() => result.current.changeView("grid"));
    expect(result.current.entry).toBeUndefined();
  });

  it("abre e fecha uma coleção na lista", () => {
    const { result } = setup();
    expect(result.current.props.openGroups.size).toBe(0);
    act(() => result.current.props.onToggleGroup("saga"));
    expect([...result.current.props.openGroups]).toEqual(["saga"]);
    act(() => result.current.props.onToggleGroup("saga"));
    expect(result.current.props.openGroups.size).toBe(0);
  });

  // Sanfona: abrir uma não fecha a outra.
  it("mantém várias coleções abertas e fecha só a que foi tocada", () => {
    const { result } = setup();
    act(() => result.current.props.onToggleGroup("saga"));
    act(() => result.current.props.onToggleGroup("outra"));
    expect([...result.current.props.openGroups].sort()).toEqual(["outra", "saga"]);
    act(() => result.current.props.onToggleGroup("saga"));
    expect([...result.current.props.openGroups]).toEqual(["outra"]);
  });

  // Guarda só as chaves: a coleção que o filtro tirou de vista volta aberta.
  it("a coleção aberta continua aberta depois de sair de vista e voltar", () => {
    const { result, rerender } = setup();
    act(() => result.current.props.onToggleGroup("saga"));
    rerender({ g: [SINGLE], a: true, f: findInLibrary });
    rerender({ g: GROUPS, a: true, f: findInLibrary });
    expect(result.current.props.openGroups.has("saga")).toBe(true);
  });
});
