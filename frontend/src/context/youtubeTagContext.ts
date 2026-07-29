import { createContext, useContext } from "react";

export interface YoutubeTagContextValue {
  // Vocabulário derivado dos dados, não de tabela: todas as tags em uso, em ordem
  // alfabética (é a lista do menu, feita para varrer).
  allTags: string[];
  // Posição da tag no ranking de popularidade (mais usada primeiro, empate em
  // ordem alfabética) — é o que ordena os chips dentro do card.
  tagRank: Map<string, number>;
  setTags: (entryId: string, tags: string[]) => void;
}

export const YoutubeTagContext = createContext<YoutubeTagContextValue | null>(null);

// O CardTags mora dentro do renderBelow do card, que só recebe o item — o contexto
// é o que evita arrastar callback por MediaGrid → MediaCard → renderBelow.
export function useYoutubeTags(): YoutubeTagContextValue {
  const ctx = useContext(YoutubeTagContext);
  if (!ctx) throw new Error("useYoutubeTags requer o YoutubeTagContext.Provider.");
  return ctx;
}
