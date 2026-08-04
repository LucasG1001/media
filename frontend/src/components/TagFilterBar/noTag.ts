// Pseudo-tag do filtro da expansão: "vídeo sem nenhuma tag". Não é uma tag de
// verdade, então o valor carrega um caractere de controle — nome digitado no
// TagPicker nunca colide com ele.
export const NO_TAG = "\u0000sem-tag";

export function tagLabel(tag: string): string {
  return tag === NO_TAG ? "Sem tag" : tag;
}
