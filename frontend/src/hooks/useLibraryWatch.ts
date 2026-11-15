import { useState } from "react";
import type { CollectionGroup } from "../utils/buildCollectionGroups";
import { pickWatchEntry } from "../utils/collectionWatch";

// As duas formas de ver a biblioteca: a grade de capas e a visão de detalhe
// (palco + lista de coleções).
export type LibraryView = "grid" | "watch";

interface LibraryWatch<M> {
  view: LibraryView;
  changeView: (view: LibraryView) => void;
  // O item no palco. undefined = a visão de detalhe não está ativa, ou não há
  // item para mostrar (biblioteca vazia ou carregando) — a página cai na grade,
  // que já tem esses estados. Filtro sem resultado não esvazia o palco: fica o
  // último item que esteve nele.
  entry: M | undefined;
  // Chamado ao trocar de aba: voltar para a biblioteca não é pedir o trailer.
  disarm: () => void;
  // O que a tela de detalhe recebe direto.
  props: {
    // Chaves das coleções abertas na lista (sanfona: várias ao mesmo tempo).
    openGroups: ReadonlySet<string>;
    onToggleGroup: (key: string) => void;
    onSelect: (member: M) => void;
    autoPlay: boolean;
  };
}

// Estado da visão de detalhe de uma biblioteca. `groups` são as coleções que a
// página já filtrou e ordenou; `active` diz se a aba da biblioteca está aberta;
// `findInLibrary` acha um item na biblioteca inteira, fora do recorte do filtro.
export function useLibraryWatch<M extends { id: string }>(
  storageKey: string,
  groups: readonly CollectionGroup<M>[],
  active: boolean,
  findInLibrary: (id: string) => M | undefined
): LibraryWatch<M> {
  const [view, setView] = useState<LibraryView>(() =>
    localStorage.getItem(storageKey) === "watch" ? "watch" : "grid"
  );
  // null = ninguém escolheu ainda: vale o primeiro da lista.
  const [choice, setChoice] = useState<string | null>(null);
  // Só as chaves: coleção que o filtro tirou de vista não é desenhada, e volta
  // aberta quando reaparece — sem efeito para limpar estado.
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());
  // O trailer só toca sozinho para um item escolhido nesta visita: a tela abre
  // num item que ninguém pediu, e voltar para ela não é pedir de novo.
  const [armed, setArmed] = useState(false);

  const watching = active && view === "watch";
  const picked = watching ? pickWatchEntry(groups, choice) : undefined;
  // Os filtros ficam no painel da lista: se o filtro sem resultado derrubasse a
  // tela para a grade, o campo de busca sairia do lugar no meio da digitação.
  // Guarda-se só o id — o item é lido de novo da biblioteca, para não envelhecer.
  const [lastId, setLastId] = useState<string | null>(null);
  if (picked && picked.id !== lastId) setLastId(picked.id);
  const entry = picked ?? (watching && lastId !== null ? findInLibrary(lastId) : undefined);

  return {
    view,
    changeView: (next) => {
      setView(next);
      setArmed(false);
      localStorage.setItem(storageKey, next);
    },
    entry,
    disarm: () => setArmed(false),
    props: {
      openGroups,
      onToggleGroup: (key) =>
        setOpenGroups((current) => {
          const next = new Set(current);
          if (!next.delete(key)) next.add(key);
          return next;
        }),
      onSelect: (member) => {
        setChoice(member.id);
        setArmed(true);
      },
      autoPlay: armed && entry !== undefined && choice === entry.id,
    },
  };
}
