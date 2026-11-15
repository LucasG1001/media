# Componentes compartilhados (frontend)

Props, slots de inversão de controle e comportamento de painel dos componentes que todas as páginas
de mídia reusam. Consulte antes de mexer em `MediaCard`, `MediaGrid`, `FranchiseGrid`,
`LibraryModalBase`, `LibraryControls`, `CoverImage`, `NotesBlock` ou `Sidebar`.

Config visual por mídia (cores, ícones, labels de status) fica em **`config/cards.tsx`**.

---

## 1. Catálogo — `MediaCard` / `MediaGrid`

Card e grade da aba de catálogo (resultado de busca na API externa). O mesmo `MediaCard` é reusado
na biblioteca, dentro do `FranchiseGrid` — as props que mudam seu comportamento lá
(`isCollectionCover`, chip de último acesso) estão em `docs/frontend-colecoes.md`.

## 2. Biblioteca — `FranchiseGrid`

Biblioteca agrupada por franquia/coleção, com seleção em lote só de **status** (`SelectionBar`).
Os slots que existiam para o YouTube antigo (`renderExpansion`, `extraActions`, formar/renomear
grupo) foram removidos junto com as coleções e tags dele.

## 3. Imagem — `CoverImage`

**Todo `<img>` de dado dinâmico passa por aqui — nunca renderize `<img>` cru para URL de terceiro.**
Ele faz duas coisas que o `<img>` não fazia:

1. aplica `utils/imageUrl.ts` (`proxied`), desviando a URL da CDN para `/api/img`, que serve a imagem
   do disco da VPS (é o que dá capa offline);
2. trata **`onError`** caindo no `fallback`. O placeholder antigo só cobria `src == null`, então
   falha de rede deixava o ícone de imagem quebrada do navegador na tela.

Props: `src`, `alt`, `className`, `fallback` (nó do placeholder), `eager` (troca o `loading="lazy"`
padrão, para capa/banner acima da dobra) e `title`. Guarda a **URL** que falhou, não um booleano, para
o erro se desfazer sozinho quando o item muda — os drawers reaproveitam a instância entre itens.
Ver `docs/offline.md`.

## 4. `LibraryModalBase`

Seletor de status derivado do mapa de labels de cada mídia + linha opcional `lastAccess` — "Última
vez assistido/jogado" em data relativa, escondida quando nunca houve acesso. Não há botão de
"consumir de novo": revisitar é o status de revisita (Reassistindo/Rejogando/Relendo), e a data
avança ao voltar dele para o concluído (regras de `last_access_at` no `CLAUDE.md`).

## 5. `LibraryControls`

Barra de biblioteca: busca + botões Filtros/Ordenação com painel que é bottom-sheet no mobile e
popover ancorado no desktop + chip de contagem; dirigido por config `filterGroups`/`sort`, cada página
monta a config do seu estado.

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

O slot **`trailing`** põe um controle da página ao lado de Filtros/Ordenação. Hoje só Jogos usa, com
o `ViewToggle` (Grade | Detalhe) — ver `docs/frontend-jogos-detalhe.md`.

## 6. `NotesBlock`

Bloco de anotação livre no fim do `content` dos drawers: textarea auto-grow com autosave por
debounce de 1 s + flush no unmount, já que fechar o drawer desmonta antes do timer. Quem monta o
bloco (e por que ele leva `key` por item) está em `docs/frontend-drawers.md`.

## 7. Navegação — `Sidebar`

No **desktop** é uma barra superior fixa (hambúrguer + logo) e um menu que fica **fechado por
padrão**: o hambúrguer o abre já com rótulos, deslizando **por cima** do conteúdo com fundo
escurecido — o conteúdo nunca é empurrado e não existe estado "recolhido" (só ícones). Fecha pelo
hambúrguer, clique no fundo, `Escape` (`useDismiss`) ou ao escolher um item. O estado é interno do
componente e **não é persistido**: toda carga começa fechada.

- O par hambúrguer + logo (`Brand`) é renderizado **duas vezes**, na barra e no cabeçalho do menu, na
  mesma posição — é o que faz o botão "não sair do lugar" com o menu por cima. Fechado, o menu é
  `inert` (fora do foco e da árvore de acessibilidade); ao abrir o foco vai para dentro dele e, ao
  fechar, volta para o hambúrguer da barra.
- **`--topbar-height`** (56 px; **0 no celular**, via media query no `:root`) é o que o conteúdo e
  todo `position: sticky` de topo descontam — `OfflineBanner` e o painel do `YoutubeWatch` hoje.
  Sticky novo no topo usa o token em vez de `top: 0`, senão fica embaixo da barra.
- No **celular** (≤768 px) nada disso aparece: a navegação é a barra inferior + seletor de mídia.
