# Componentes compartilhados (frontend)

Props, slots de inversão de controle e comportamento de painel dos componentes que todas as páginas
de mídia reusam. Consulte antes de mexer em `MediaCard`, `MediaGrid`, `FranchiseGrid`,
`LibraryModalBase`, `LibraryControls` ou `NotesBlock`.

Config visual por mídia (cores, ícones, labels de status) fica em **`config/cards.tsx`**.

---

## 1. Catálogo — `MediaCard` / `MediaGrid`

Card e grade da aba de catálogo (resultado de busca na API externa). O mesmo `MediaCard` é reusado
na biblioteca, dentro do `FranchiseGrid` — as props que mudam seu comportamento lá
(`isCollectionCover`, `showLastAccess`) estão em `docs/frontend-colecoes.md`.

## 2. Biblioteca — `FranchiseGrid`

Biblioteca agrupada por franquia/coleção. Aceita:

- **`renderExpansion`** — inversão de controle da expansão: a página decide o que vai antes dos
  cards e **quais membros** volta para o `renderMembers` (é o que o YouTube usa para o filtro de
  tag; ver `docs/frontend-youtube-tags.md`).
- **`extraActions`** — ações extra repassadas à `SelectionBar` com os ids selecionados, habilitadas
  só com a seleção numa única coleção.

## 3. `LibraryModalBase`

Seletor de status derivado do mapa de labels de cada mídia + linha opcional `lastAccess` — "Última
vez assistido/jogado" em data relativa, escondida quando nunca houve acesso. A prop `again` (botão
"🔁 Assisti/Joguei/Li de novo") é regida pelas regras de `last_access_at` no esquema (ver
`CLAUDE.md`).

## 4. `LibraryControls`

Barra de biblioteca: busca + botões Filtros/Ordenação com painel que é bottom-sheet no mobile e
popover ancorado no desktop + chip de contagem; dirigido por config `filterGroups`/`sort`/`toggle`
(este último é um botão liga/desliga sem painel — hoje o "Último acesso"), cada página monta a
config do seu estado.

O gatilho da **Ordenação é dividido** (`onIconClick` do `ControlPopover`): o ícone **inverte a
direção** — é ele que a mostra — e o rótulo abre o painel; são dois botões irmãos porque `<button>`
dentro de `<button>` é inválido, mas sem divisor visual (parece uma pílula só). Inverter =
reselecionar o critério ativo, que é o que o `useSingleSort` já trata como troca de direção.

O ícone do **Filtros fica roxo** enquanto houver filtro ativo (`iconActive`).

As opções de filtro ficam em **grade** (`.filterOptions`), não em `flex-wrap`: com rótulos de
larguras diferentes o wrap desalinhava as linhas; rótulo longo trunca com reticências e o texto
inteiro vai no `title`; o grupo de opções em si é o `FilterCheckboxGroup` — `layout="grid"`
(default) alinha as colunas, `layout="wrap"` põe uma opção do lado da outra e quebra a linha, para
rótulos curtos; `count` por opção; grupo com mais de 12 opções rola dentro de si, porque o painel
não tem teto de altura.

Uma **única busca de opções** fica no topo do painel, abaixo do "Limpar tudo", e filtra **todos** os
grupos de uma vez (aparece a partir de 10 opções somando os grupos; grupo sem casamento sai inteiro).

O painel tem `panelWidth`: `"wide"` fixa no teto de 560 px, `"fit"` cresce com o conteúdo até esse
teto — `max-content`, porque o painel é absoluto dentro do botão e o shrink-to-fit resolveria pela
largura dele.

## 5. `NotesBlock`

Bloco de anotação livre no fim do `content` dos drawers: textarea auto-grow com autosave por
debounce de 1 s + flush no unmount, já que fechar o drawer desmonta antes do timer. Quem monta o
bloco (e por que ele leva `key` por item) está em `docs/frontend-drawers.md`.
