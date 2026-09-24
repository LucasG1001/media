# Biblioteca: coleções, filtros e ordenação (frontend)

Como a biblioteca de cada mídia é agrupada em coleções e o que filtro e ordenação fazem com esses
grupos. São **invariantes** — valem para todas as mídias com coleção. Consulte antes de mexer em
`buildFranchiseGroups`/`build*CollectionGroups`, `utils/sortGroups.ts`, `filterGroupsBySearch`,
`hooks/useSingleSort.ts`, `FranchiseGrid`/`FranchiseCard` ou no pipeline de biblioteca de uma página.

Séries são um caso próprio (coleção sintetizada de temporadas): ver
`docs/frontend-series-temporadas.md`. YouTube tem o filtro de tag dentro da expansão: ver
`docs/frontend-youtube-tags.md`.

---

## 1. Agrupamento

`buildCollectionGroups` agrupa por franquia/coleção; cada grupo tem `representative` (capa:
`isCover` senão o mais antigo), `members`, `count`, `completedCount`. Os `build*CollectionGroups` só
**agrupam** (não ordenam).

## 2. Filtro decide quais coleções aparecem (a coleção continua inteira)

Os filtros são **multi-seleção** (arrays) e viram um `memberFilter` passado ao builder **só quando
há filtro ativo**. Ele decide só duas coisas: se a coleção aparece (**pelo menos um** membro bate) e
o numerador do badge. **Capa e expansão (`members`) são sempre da coleção inteira.** O badge é
`completedCount/count`: o **denominador `count` é SEMPRE o total da coleção**; o **numerador**
(`completedCount`, não mais "concluídos") é o total quando **sem filtro** e a **qtde que bate**
quando há filtro. Ex.: coleção de 6 → sem filtro `6/6`; filtro "planejo" → `3/6`, e a expansão
mostra os 6 com a capa de sempre. Coleção sem match some. Sem filtro (array vazio): `memberFilter` fica `undefined`, mostra tudo (inclusive `dropped`),
escondendo só coleções 100% `dropped` (`.filter(some não-dropped)` na página).

`filterGroupsBySearch` casa por título **do representante ou de qualquer membro** — o representante
entra por causa das séries, onde os membros são as temporadas ("Temporada 1"...) e o nome da série
existe só nele.

## 3. Grupos de filtro por mídia

Todos member-level e combinados em **E** entre si, **OU** dentro de cada um (menos Gêneros, abaixo):

- anime = Status + **Exibição** (`animeStatus`, 3 estados) + Gêneros
- filmes = Status + **Lançamento** (`movieStatus`) + Gêneros
- séries = Status + **Exibição** + Gêneros
- jogos = Status + **Lançamento** (`gameStatus`) + Modos de jogo + Gêneros
- livros = Status + **Lançamento** (`bookStatus`) + Gêneros
- YouTube tem só **Coleção**, e o resto do recorte é por tag dentro da expansão

**Gêneros é E e facetado** (`utils/genreFacets.ts`): o item precisa ter **todos** os marcados, e as
opções (com contagem) são recalculadas sobre os itens que já passam nos outros grupos **e** nos
gêneros marcados — cada marcação encolhe a lista para o que ainda coexiste com ela, então nunca se
chega a resultado vazio. Os marcados ficam sempre na lista, para desmarcar. Item com `genres` nulo
(ainda não sincronizado) some quando há gênero marcado. Rótulos PT só para AniList/IGDB/Hardcover
(conjuntos em inglês); o TMDB já vem em pt-BR.

**Séries é a exceção**: o de Exibição é da série, não da temporada (o TMDB não dá status de exibição
por temporada), então recorta a lista de entries **antes** do `buildSeasonGroups`, enquanto o de
Status segue member-level. Gênero também é da série, mas recorta as coleções **depois** do
`buildSeasonGroups` (coleção = série), para as opções contarem só séries que passam no Status das
temporadas. O mapeamento `air_status` cru → `on_air`/`finished`/`upcoming` fica em
`utils/seriesFormat.ts`.

## 4. Ordenação

De seleção única (`hooks/useSingleSort.ts`; sempre uma ativa), opera sobre a **coleção inteira** (o filtro não reduz `members`),
via `utils/sortGroups.ts`: **data** = item **mais antigo** da coleção (`sortGroupsByMemberDate`,
`agg:"oldest"`); **nota** = **média** das notas dos membros com `score>0` (`sortGroupsByAvgScore`).
Exceção: Livros "Leitura" usa a data de leitura **mais recente** (`agg:"latest"`). Avulsos contam
como coleção de 1.

Padrões: anime/filmes/jogos = Lançamento(desc)+Nota; séries idem; livros =
Publicação(desc)+Leitura+Nota+Último acesso.

## 5. A expansão de livros ordena por `series_position`

Não por data: é o único caso em que a ordem dos membros vem de um campo **guardado** da API (a
posição na série da Hardcover, com meio-valor real — 0.5 para conto, 3.5 para novela). É a ordem de
leitura, e por isso a posição vence a data de publicação (em Hunger Games o prequel é posição 0 e o
mais recente). Posição nula vai para o fim, e `reverseMembers` fica `false` (as outras mídias
invertem).

## 6. Último acesso é derivado na coleção, nunca guardado

O valor do grupo é o **mais recente** entre os membros (`latestAccess` em `utils/lastAccess.ts`;
ordenação "Último acesso" = `sortGroupsByMemberDate(..., lastAccessTimeOf, agg:"latest")`, com nunca
acessado valendo 0). É o que faz item que entra numa coleção passar a compor o máximo dela e, ao
sair, voltar a valer por si — sem escrita nem sincronização. Mesmo espírito da nota, que é a média
dos membros.

**A data no card é opt-in**: o botão "Último acesso" da barra (`showLastAccess`, propagado até o
`MediaCard`) revela um chip em **todos** os cards — capa, membros da expansão e avulsos. Por padrão
nada aparece: o card já carrega título, ano, status e nota. O chip entra **dentro do overlay**, acima
do título (não cobre nada), e **flutua** no canto de baixo da imagem quando a mídia não tem overlay
(YouTube, que descreve o vídeo abaixo da imagem). Cor por faixa (`lastAccessTone`): até 1 ano, 1–5
anos, 5+ anos e nunca — as mesmas faixas que o filtro por tempo vai usar.

## 7. Capa é só coleção

Todas as mídias com coleção; prop `coverIsCollectionOnly` do `FranchiseGrid`/`FranchiseCard`. Em
grupo com 2+ itens a capa exibe apenas a **média** e o clique **expande/recolhe** em vez de abrir o
drawer do representante (que segue acessível como membro da expansão, já que
`buildCollectionGroups` inclui o representante em `members`). O `MediaCard` recebe
`isCollectionCover` e some com **tudo que é estado de item**: botão de status e badge de
exibição/lançamento — na coleção esse estado é dos membros, e o representante é só quem empresta a
capa. O topo assim liberado é ocupado pela contagem `que batem/total` do `FranchiseCard` (classe
`.badgeTop`).

**Grupo de 1 item é card simples normal**: botão de status (status/nota/remover) + drawer no clique.
Como `count` é o total **não filtrado**, um grupo de 2+ com só 1 membro batendo no filtro continua
sendo coleção.
