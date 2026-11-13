# Tier List (frontend)

Página `/tierlist`: as coleções de uma mídia distribuídas em faixas pela nota. Consulte antes de mexer
em `utils/tierList.ts`, `utils/tierStyles.ts`, `utils/tierListImage.ts`, `hooks/useTierStyles.ts`,
`pages/TierListPage/` ou `components/TierSettingsModal/`.

---

## 1. É uma visão, não um dado

O tier list é **somente leitura e derivado**: não tem tabela, coluna nem endpoint. Agrega no cliente
sobre as bibliotecas que os stores já carregam (como o Dashboard) e por isso funciona offline. Não há
arraste nem ordem manual — quem muda a posição de algo é a nota, dada pelos caminhos de sempre
(modal da biblioteca, modal da temporada).

Cobre as cinco mídias com nota (YouTube fica de fora). O filtro de mídia é **seleção única e
obrigatória**: a página sempre mostra exatamente uma.

## 2. Unidade, faixa e ordem

- **Unidade = coleção**, nas cinco mídias, montada pelos mesmos `build*CollectionGroups` /
  `buildSeasonGroups` da biblioteca (sem `memberFilter`). Título e capa são os do representante, ou
  seja, a capa que o usuário já escolhe na biblioteca (`is_cover` / `cover_season`).
- **Nota = `averageScore(group.members)`**, a mesma média que a biblioteca mostra e ordena: só membros
  com nota > 0 entram, qualquer que seja o status deles.
- **Faixa** (`bandOf`): 9+ / 7+ / 5+ / 3+ / abaixo de 3. A comparação usa a nota **arredondada a uma
  casa**, que é a que aparece na tela — senão uma média 8,97 seria exibida como "9.0" dentro de "Bom".
- **Ordem na fileira**: nota maior à esquerda (pela média crua, então 9,25 vem antes de 9,2); empate
  desempata por título.

Quem entra (`buildTierTiles`):

| Situação da coleção | Onde aparece |
|---|---|
| Algum membro concluído ou em revisita, com média > 0 | Faixa da média |
| Algum membro concluído ou em revisita, sem nenhuma nota | Bandeja "Sem nota" |
| Nenhum concluído e algum abandonado | Fileira "Dropado" |
| Só planejado | Não aparece |

O contador ao lado de cada mídia é o total de "Sem nota" dela, **independente dos filtros de ano** —
serve para ver o que falta avaliar em todas as mídias sem trocar de aba.

## 3. Filtros de ano

Dois seletores independentes, ambos com "todos" como padrão: **Lançado em** e **Concluído em**. Eles
decidem **só quais coleções aparecem**; a nota e a faixa são sempre as da coleção inteira. Uma coleção
aparece em **todo** ano em que bate — 1ª temporada concluída em 2025 e 2ª em 2026 põem a mesma peça,
na mesma faixa, nas duas listas.

Cada peça guarda uma marca `{ released, completed }` **por membro** (`TierTile.marks`), e o filtro
passa se **alguma marca** bate. Por isso os dois filtros juntos valem para o **mesmo membro**: "lançado
em 2026" + "concluído em 2026" não é satisfeito por uma temporada de 2020 vista em 2026 somada a uma
de 2026 vista em 2027.

Quem gera marca:

- Coleção com membro concluído: **só os concluídos/em revisita**. Membro planejado ou abandonado não
  marca — uma sequência ainda não vista não pode colocar a coleção no ano dela.
- Coleção em "Dropado": os membros **abandonados**, sempre com `completed: null`.

De onde saem os anos:

| | Lançamento | Conclusão |
|---|---|---|
| Anime | `seasonYear`, senão o ano de `endDate` | `watchedAt` |
| Filmes | `releaseDate` | `watchedAt` |
| Séries (temporada) | `airDate` da temporada | `lastAccessAt` da temporada |
| Jogos | `released` | `finishedAt` |
| Livros | `publishedDate` | `readAt` |

O ano de lançamento sai **do texto** da data (`releaseYearOf`), não de `new Date()`: data sem hora é
lida como meia-noite UTC, e em fuso negativo 1º de janeiro viraria 31 de dezembro do ano anterior.

Limitações que vêm do dado:

- **Séries usam `lastAccessAt` da temporada** na conclusão: `season_states` não guarda data de
  conclusão. Reassistir uma temporada a leva para o ano da revisita.
- **"Dropado" não tem ano de conclusão** (o app não registra quando algo foi abandonado): some com
  "Concluído em" — a página avisa isso numa linha — e aparece normalmente com "Lançado em".
- **Concluído sem data** (linha anterior à coluna de conclusão) não aparece com "Concluído em".

O ano selecionado pode não existir na mídia para a qual se trocou; `activeReleased`/`activeCompleted`
caem em "todos" por derivação, sem efeito corrigindo estado.

## 4. Rótulos e cores

Cinco faixas + "Dropado" têm nome e cor editáveis (`TierSettingsModal`); os limites de nota são fixos
e "Sem nota" não é editável (é bandeja, não faixa). Fica em **`localStorage`** (`tier-list-styles`),
não no banco: é preferência de exibição por navegador e não entra no backup. Só o que difere do padrão
é gravado (`diffTierOverrides`), e o que volta do storage é validado (`parseTierOverrides`).

As cores padrão são **tokens** do `global.css` (`TIER_COLOR_TOKENS`), resolvidos para hex em runtime
por `utils/cssVar.ts` — o `<input type="color">` e o canvas só aceitam valor literal. A cor do texto do
rótulo sai da luminância do fundo (`isLightColor`), para uma cor escolhida pelo usuário não deixar o
nome ilegível.

## 5. Exportar imagem

`renderTierListImage` desenha um PNG de 1600 px de largura **à mão em canvas**, sem dependência:
cabeçalho (mídia + filtros de ano ativos), as cinco faixas (vazias inclusive) e "Dropado" quando tem item. A bandeja
"Sem nota" fica de fora. Respeita os filtros da tela.

- A geometria (`layoutTierImage`) é separada do desenho para ser testável — o jsdom não tem canvas.
- As capas são carregadas por `/api/img` (**mesma origem**): com a URL crua da CDN o canvas ficaria
  "tainted" e o `toBlob` lançaria `SecurityError`.
- Capa que falha vira placeholder com o título; uma imagem ruim não derruba a exportação.

## 6. Interação

Clique abre o drawer do item-capa, com `DrawerNav` percorrendo a coleção na ordem da expansão da
biblioteca (`collectionNav` sobre os grupos da mídia). Séries abrem o `SeriesDrawer`, que não tem
navegação. Título e nota aparecem no hover; em tela de toque (`hover: none`) a nota fica sempre visível.
