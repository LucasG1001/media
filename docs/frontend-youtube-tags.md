# YouTube: coleções e tags (frontend)

A biblioteca do YouTube é `FranchiseGrid` como as outras, mas a organização **dentro** de cada
coleção é por **tag**. Aqui estão a invariante central (tag só existe dentro de coleção), o filtro
que vive na expansão, o menu de tag em portal e a sugestão por coocorrência. Consulte antes de mexer
em `YoutubePage`, `utils/youtubeTagFilter.ts`, `TagFilterBar/`, `TagChip`/`CardTags`, `TagPicker`,
`TagSuggestions`, `TagBulkModal` ou nos endpoints de tag.

Os invariantes gerais de coleção estão em `docs/frontend-colecoes.md`; o drawer e o player, em
`docs/frontend-drawers.md`.

---

## 1. Visão geral da página

A biblioteca é `FranchiseGrid` como as outras (capa/expansão, `buildYoutubeCollectionGroups` +
`sortGroups`), mas a organização **dentro** de cada coleção é por **tag**. Pipeline em `useMemo`:
agrupa → filtro de coleção → `applyStatusView` (aba de status) → busca (título/canal) → ordenação
por grupo. Ordenação (`useSingleSort`, padrão Alfabética(asc)): Alfabética, Data e Visualizações.
**Vídeo avulso vem sempre antes das coleções** (`standaloneFirst`, aplicado depois da ordenação), em
qualquer critério e direção — a ordenação escolhida vale dentro de cada bloco.

Abrir o drawer do vídeo **registra acesso** (`registerAccess` → `POST /:id/access`, otimista) — ver
`last_access_at` no esquema, em `CLAUDE.md`.

**No topo**, o `LibraryControls` tem o grupo de filtro **Coleção** (com "Sem coleção") + busca +
Ordenação. **Não existe filtro de canal** — recortar por canal é pela busca por texto, que já
procura no nome dele.

## 2. Invariante central: tag só existe dentro de coleção

Vídeo avulso tem `tags = '{}'` e **não mostra nem a linha de chips**. Sair da coleção
(`removeFromCollection`) **e trocar de coleção** (`assignCollection`,
`CASE WHEN collection_id IS DISTINCT FROM`) zeram as tags — o vocabulário é da coleção de origem e
não significa nada na de destino. A regra é firmada em três camadas:
`UPDATE ... WHERE collection_id IS NULL AND cardinality(tags) > 0` a cada boot no `migrate()`,
`AND collection_id IS NOT NULL` nos endpoints de tag em lote, e um wrapper no `update` do
controller que descarta `tags` do payload de vídeo avulso.

## 3. Tags

`tags TEXT[]` (`[]` = sem tag), **N por vídeo**. Vocabulário derivado dos próprios dados, sem tabela.
Contado **por coleção** (`byCollection` na página → `youtubeTagContext`): `allTagsFor`, `rankFor` e
`recommendFor` recebem todos o `collectionId`. A mesma palavra em duas coleções são dois vocabulários
independentes.

## 4. Navegação da coleção no drawer

A navegação da coleção aqui vai **sobre o player** (`overlay` do `TrailerEmbed`), não no canto: o
vídeo é o conteúdo, não um extra. A sequência usa `utils/youtubeTagFilter.ts` (`visibleMembers`), o
mesmo do `renderExpansion` — senão o "próximo" levaria a um vídeo que o filtro de tag tirou de vista.

O drawer **não** tem `key` por vídeo: remontá-lo destruiria o elemento em tela cheia e o navegador
sairia dela a cada troca. Por isso o acesso é registrado por mudança de `entry.id` (não por
montagem) e quem remonta por vídeo é só o `NotesBlock` — ele guarda o texto em estado interno e
descarrega o pendente ao desmontar, então sem `key` a anotação de um vídeo vazaria para o outro.

## 5. O filtro de tag vive dentro da expansão

Via `renderExpansion` do `FranchiseGrid` — inversão de controle: a página decide o que vai antes dos
cards e **quais membros** volta para o `renderMembers`. É isso que faz o filtro reduzir **só a
expansão**: a capa e o badge `mostrados/total` não o enxergam. Estado em
`Record<group.key, string[]>` (o `expandedKey` é do `FranchiseGrid`; chavear por grupo evita
espelhá-lo, e reabrir devolve o filtro onde estava).

- `TagSuggestionRow` acima e `SelectedTagRow` abaixo (✕ no hover, e **sempre visível em
  `@media (hover: none)`** — no celular não há hover e não haveria como remover). Cada linha some
  quando não tem conteúdo. O wrapper `.expansionFilter` tem `grid-column: 1 / -1`: a expansão é grid
  e sem isso a faixa viraria mais uma coluna.
- Tags filtradas combinam em **E**: o vídeo precisa ter **todas**.
- **"Sem tag"** (`NO_TAG`, pseudo-tag sentinela em `TagFilterBar/noTag.ts`) é o único recorte que o E
  não alcançaria — vídeo sem tag nunca casa com tag alguma. Entra **no fim** da faixa de sugestão
  (não disputa slot com o limite; antes das tags mentiria sobre a ordem por contagem) e só **sem
  filtro ativo**, quando há membro sem tag. É **exclusivo**: clicar zera o resto, e com ele ativo a
  faixa de sugestão desaparece por não ter companheira — mesmo caminho da combinação que esgota as
  tags, sem ramo próprio. Chip de estilo **neutro** (borda tracejada), fora da cor por hash: ausência
  de tag não deve se passar por uma do vocabulário.
- A contagem sai do conjunto **já visível da coleção** — "quantos resultados se eu marcar essa tag",
  com a interseção aplicada. Por isso **toda tag sugerida tem pelo menos um resultado** (não há beco
  sem saída, e o chip não precisa mostrar contagem), e combinação que esgotou as companheiras faz a
  faixa **desaparecer**. Ordem: contagem desc com **desempate alfabético** (sem ele a faixa trocaria
  de ordem entre renders).

## 6. Chips no card

`TagChip`/`CardTags`: linha própria abaixo de duração/views, com **altura fixa de 2 linhas de chip e
`overflow: hidden`** — tag que não cabe fica escondida e o card **nunca cresce** (o corte é
determinístico porque o chip tem altura fixa; o menu é onde se vê tudo). Ordenados por
**popularidade** (`rankFor(collectionId)`, com desempate alfabético), então o que o corte esconde é
sempre a tag menos relevante. Cor por hash do nome (`utils/chipColor.ts` → tokens `--color-chip-N`),
então a mesma tag tem sempre a mesma cor. **A linha inteira** abre o menu (um "+" no fim seria
justamente o que o corte esconde); sem tag, mostra um chip fantasma `+ tags`.

## 7. Menu de tag

`TagPicker`, **em portal** — `MediaCard` tem `overflow: hidden` e clipa menu absoluto. Multi-seleção
**em ordem alfabética** (é a lista para varrer; o ranking ordena o card, não o menu) com **campo de
busca que acumula os dois papéis**, filtrar e criar — "Criar «x»" só aparece quando não há casamento
exato. **Navegável por ↑/↓ com Enter escolhendo o item sob o cursor** (o "Criar" é o primeiro da
sequência; o hover move o cursor, para não haver dois destaques); o cursor é **clampado em render**,
já que a lista encurta enquanto se digita.

Reposiciona no scroll em vez de fechar (fechar matava a rolagem da própria lista e o texto sendo
digitado), e **barra a propagação de tecla, menos Escape**: evento de portal sobe pela árvore React,
então o Enter da busca chegava no `onKeyDown` do `MediaCard` e abria o drawer; Escape tem que passar
para o `useDismiss` fechar. Lê tudo do `youtubeTagContext`, que evita arrastar callback até o
`renderBelow` (ele só recebe o item).

## 8. Sugestão de tag por coocorrência

`TagSuggestions`, faixa acima do menu, só com ele aberto: as **4 tags que mais aparecem nos vídeos da
coleção que têm TODAS as tags atuais** do vídeo (interseção, não união), por contagem desc com
desempate alfabético — sem desempate a sugestão trocaria de lugar entre renders. `recommendFor(id,
[])` **degenera na contagem da coleção** (o `every` sobre lista vazia é verdadeiro para todos), então
vídeo sem tag sugere as mais usadas sem ramo próprio. Clicar adiciona e a faixa **se recalcula** com
a combinação nova; sem nada a sugerir (combinação que nenhum outro vídeo tem) a faixa
**desaparece**, em vez de cair para um fallback não relacionado. Contado em memória sobre o store —
sem endpoint.

## 9. Posição do portal

A pilha (faixa + menu) é ancorada por `top` abrindo para baixo e por **`bottom`** quando não há
espaço embaixo. Ancorar o rodapé é o que deixa a faixa crescer para cima **sem medir a altura dela**
— e tirou o palpite de altura que o cálculo de flip usava antes.

## 10. Tag em lote

Pelas `extraActions` do `FranchiseGrid` → `SelectionBar` → `TagBulkModal`, com dois modos:
**Adicionar tag** (`POST /bulk-add-tag`) e **Remover tag** (`POST /bulk-remove-tag`) — com N tags
"definir" não faria sentido. No modo remover só são oferecidas as tags que os selecionados têm. As
ações extra só habilitam com os selecionados **numa única coleção e nenhum avulso** — coerente com a
invariante da tag.

## 11. Playlist importada

Vira uma **coleção com o nome dela**; o `ON CONFLICT` usa
`COALESCE(collection_id, EXCLUDED.collection_id)`, então reimportar não rouba vídeo de outra coleção.

## 12. Modelos removidos

Os modelos anteriores de classificação (tag única escopada à coleção e o par
categoria/subcategoria) foram **removidos**; o `migrate()` dropa as colunas que sobraram.
