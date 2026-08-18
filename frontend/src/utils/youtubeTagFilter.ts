import type { YoutubeLibraryEntry } from "../types/youtubeLibrary";
import { NO_TAG } from "../components/TagFilterBar/noTag";

// Membros de uma coleção que sobram depois do filtro de tag da expansão. Vive
// aqui, e não dentro do renderExpansion, porque a navegação entre vídeos do
// drawer precisa da MESMA lista: se divergissem, o botão "próximo" levaria a um
// vídeo que não está à vista.
//
// Tags combinam em E (o vídeo precisa ter todas). "Sem tag" é exclusivo —
// combiná-lo com uma tag real daria conjunto vazio sempre —, então ou o filtro é
// ele, ou é uma lista de tags de verdade.
export function visibleMembers(
  members: YoutubeLibraryEntry[],
  selected: string[]
): YoutubeLibraryEntry[] {
  if (selected.length === 0) return members;
  if (selected[0] === NO_TAG) return members.filter((m) => m.tags.length === 0);
  return members.filter((m) => selected.every((tag) => m.tags.includes(tag)));
}
