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

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function setup(groups = GROUPS, active = true) {
  return renderHook(({ g, a }) => useLibraryWatch(KEY, g, a), { initialProps: { g: groups, a: active } });
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
    rerender({ g: [SAGA], a: true });
    expect(result.current.entry).toBe(SAGA.members[0]);
    expect(result.current.props.autoPlay).toBe(false);
  });

  it("abre e fecha uma coleção na lista", () => {
    const { result } = setup();
    expect(result.current.props.openGroup).toBeUndefined();
    act(() => result.current.props.onOpenGroup("saga"));
    expect(result.current.props.openGroup).toBe(SAGA);
    act(() => result.current.props.onCloseGroup());
    expect(result.current.props.openGroup).toBeUndefined();
  });

  it("coleção de um item só não abre, e a que saiu de vista deixa de estar aberta", () => {
    const { result, rerender } = setup();
    act(() => result.current.props.onOpenGroup("avulso"));
    expect(result.current.props.openGroup).toBeUndefined();

    act(() => result.current.props.onOpenGroup("saga"));
    rerender({ g: [SINGLE], a: true });
    expect(result.current.props.openGroup).toBeUndefined();
  });
});
