import { createContext, useContext } from "react";

// Tudo é por coleção: a tag só existe dentro de uma, e o vocabulário de uma
// coleção não significa nada na outra. Daí o `collectionId` em cada leitura.
export interface YoutubeTagContextValue {
  // Vocabulário derivado dos dados, não de tabela: as tags em uso naquela coleção,
  // em ordem alfabética (é a lista do menu, feita para varrer).
  allTagsFor: (collectionId: number) => string[];
  // Posição da tag no ranking de popularidade da coleção (mais usada primeiro,
  // empate em ordem alfabética) — é o que ordena os chips dentro do card.
  rankFor: (collectionId: number) => Map<string, number>;
  // Coocorrência dentro da coleção: as tags que mais acompanham **todas** as tags
  // passadas. Lista vazia devolve as mais usadas da coleção.
  recommendFor: (collectionId: number, tags: string[]) => string[];
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
