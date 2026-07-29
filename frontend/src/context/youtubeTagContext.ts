import { createContext, useContext } from "react";

export interface YoutubeTagContextValue {
  // Vocabulário derivado dos dados: as tags em uso naquela coleção, ordenadas.
  tagsOf: (collectionId: number | null) => string[];
  setTag: (entryId: string, tag: string | null) => void;
}

export const YoutubeTagContext = createContext<YoutubeTagContextValue | null>(null);

// O TagChip mora dentro do renderBelow do card, que só recebe o item — o contexto
// é o que evita arrastar callback por FranchiseGrid → MediaCard → renderBelow.
export function useYoutubeTags(): YoutubeTagContextValue {
  const ctx = useContext(YoutubeTagContext);
  if (!ctx) throw new Error("useYoutubeTags requer o YoutubeTagContext.Provider.");
  return ctx;
}
