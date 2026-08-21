# Drawers, trailer e anotações (frontend)

Navegação de coleção dentro do drawer, teclado, tela cheia própria do player e o bloco de
anotação. Vale para os seis drawers (`AnimeDrawer`, `MovieDrawer`, `SeriesDrawer`, `SeasonDrawer`,
`GameDrawer`, `BookDrawer`, `YoutubeDrawer`). Consulte antes de mexer em `hooks/useDrawerKeys.ts`,
`DrawerNav`, `utils/collectionNav.ts`, `TrailerEmbed` ou no bloco de anotação de um drawer.

---

## 1. Navegação e teclado (todas as mídias)

`hooks/useDrawerKeys.ts` centraliza Escape + trava de scroll + setas ← → dos seis drawers (antes
cada um repetia o efeito). Escape **não fecha em tela cheia** — ali ele é do navegador, para sair
dela; as setas são ignoradas com o foco em campo de texto (o `NotesBlock` é textarea).

O componente é o `DrawerNav` (‹ contador ›), no canto superior do drawer (`variant="corner"`) ou
sobreposto ao player (`"float"`). A sequência sai de `utils/collectionNav.ts` (`collectionNav`),
genérico sobre os grupos **já filtrados e ordenados** pela página — a ordem é sempre a que está na
tela. Devolve `null` para item fora de coleção ou coleção de 1, e só é ligado na aba **biblioteca**
(no catálogo a lista exibida é outra). Em séries a coleção são as **temporadas**, então navega entre
elas. No YouTube a sequência usa `visibleMembers` do filtro de tag (ver
`docs/frontend-youtube-tags.md`).

## 2. Nenhum drawer leva `key` por item

**Nenhum drawer leva `key` por item na página**: remontar destruiria o elemento em tela cheia e o
navegador sairia dela a cada troca. Em troca, o que dependia da remontagem é tratado dentro de cada
drawer: o payload é guardado **junto com o id a que pertence** (`{ id, data }`) e `loading`/`error`
saem daí por derivação — estado solto seguiria mostrando o item anterior enquanto busca, ou grudaria
um erro antigo (repor com `setState` no corpo do efeito não serve: o lint barra, com razão). E o
`NotesBlock` leva `key` por item, porque guarda o texto em estado interno e a anotação de um vazaria
para o seguinte.

## 3. Trailers

`autoPlay` ligado em todas as mídias, e a navegação da coleção aparece **também sobre o player**
(`overlay`), além do canto — em livro, que não tem trailer, só o canto. Em séries o
`SeriesDetailBody` repassa a sobreposição via `playerOverlay`, já que é ele que monta o player.

## 4. `TrailerEmbed` tem tela cheia própria

`fs=0` no embed + botão que expande o **wrapper**, não o iframe: em tela cheia só o elemento
fullscreen e seus descendentes são pintados, e nada pode ser injetado num iframe de outra origem —
expandindo o iframe, qualquer sobreposição sumiria.

Os controles são revelados por `:hover` **em CSS**, nunca por JS: o iframe engole os eventos de
mouse, mas hover sobre ele mantém os ancestrais em `:hover`. Sempre visíveis em
`@media (hover: none)`. O botão de tela cheia não aparece onde `document.fullscreenEnabled` é falso
(iOS não tem tela cheia de elemento).

O slot `overlay` fica **fora** do grupo de opacidade dos controles: no `variant="float"` do
`DrawerNav` cada seta se revela pelo hover **dela** (opacidade 0 não tira o elemento do hit-test,
então não é preciso zona invisível roubando clique do player), encostada na borda e sem contador —
em cima do vídeo, controle que aparece a cada passada de mouse atrapalha. Na ponta da coleção a seta
**some** em vez de ficar desabilitada.

`autoPlay` é **opt-in** (só o YouTube, onde o vídeo é o conteúdo): o clique que abriu o drawer vale
como gesto do usuário, então o autoplay costuma passar.

## 5. Anotações

O drawer não conhece a biblioteca (recebe só o ID externo e busca na API externa), então
`notes`/`onNotesChange` são props **opcionais** que a página passa só quando acha a entry — é isso
que esconde o bloco no catálogo. Séries são a exceção: a anotação é da **temporada**
(`SeasonDrawer` → `saveSeasonNotes` → `PUT /:id/seasons/:n/notes`, endpoint separado do
`saveSeason`, que exige status/nota válidos); o `SeriesDrawer` não tem bloco.
