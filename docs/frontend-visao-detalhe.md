# Visão de detalhe da biblioteca (frontend)

As bibliotecas de **Anime, Filmes, Séries e Jogos** têm **duas visualizações** da mesma lista de
coleções, alternadas pelo `LibraryViewToggle` na barra da biblioteca: a **Grade** (`FranchiseGrid`, a
de sempre) e o **Detalhe**: palco grande à esquerda e as coleções como lista à direita, no desenho
da tela do YouTube. Livros só têm a grade; o YouTube já é essa tela (`docs/frontend-youtube.md`).
Consulte antes de mexer em `CollectionWatch`, nos invólucros (`AnimeWatch`, `MovieWatch`,
`SeriesWatch`, `GameWatch`), em `hooks/useLibraryWatch.ts`, `utils/collectionWatch.ts`,
`ViewToggle`, `hooks/useMediaDetail.ts` ou nos `*DetailSections`.

---

## 1. Como está dividido

- **`CollectionWatch`** é o componente genérico: layout, palco, ações, lista em dois níveis,
  teclado e anotação. Não busca nada e não conhece nenhuma mídia.
- **Cada mídia tem um invólucro fino** que busca o detalhe (`hooks/useMediaDetail.ts`) e entrega ao
  `CollectionWatch` o que é dela: um `WatchConfig` (capa, segunda linha da linha de um item,
  rótulos), título/subtítulo, trailer, imagem do palco e as seções do detalhe como `children`.
- **`useLibraryWatch(storageKey, groups, active, findInLibrary)`** guarda o estado na página: a visualização
  (`localStorage`, uma chave por mídia — `anime-library-view`, `movies-library-view`,
  `series-library-view`, `games-library-view`; ausente = grade), o item escolhido, as coleções
  abertas (um conjunto de chaves) e se o trailer está armado. Devolve `entry` (o item do palco) e `props`, que a página espalha no
  invólucro.

## 2. O que é da página

- A visão só vale na aba **Minha Biblioteca** — catálogo é sempre grade com drawer.
- **A lista são os mesmos grupos da grade**: filtros, busca e ordenação da `LibraryControls` valem
  igual, e os invariantes de `docs/frontend-colecoes.md` continuam (o filtro decide quais coleções
  aparecem; a coleção aberta mostra **todos** os membros).
- **A barra de filtros é uma só, em dois lugares**: a página monta a `LibraryControls` numa constante
  e a põe no topo (Grade) ou a entrega ao painel pelo slot `controls`, na variante `compact`
  (`docs/frontend-componentes.md` §5) — acima da lista e fora da área que rola, como os controles do
  YouTube. Em tela estreita ela desce com a lista para baixo do palco.
- **Não há rota por item**: o item aberto é estado (a `id` do membro). O que está no palco é
  derivado por `pickWatchEntry`: o escolhido enquanto a coleção dele estiver na tela, senão o
  **primeiro item da primeira coleção** — sem efeito para consertar a escolha quando o filtro muda.
  Sem item para mostrar (biblioteca vazia ou carregando) `entry` vem vazio e a página cai na grade,
  que já tem esses estados.
- **Filtro sem resultado não derruba para a grade**: o palco fica com o último item que esteve nele
  e a lista mostra "Nenhum resultado." — cair na grade levaria a barra de volta ao topo, e o campo de
  busca perderia o foco no meio da digitação. O hook guarda só o id e relê o item por
  `findInLibrary` (a biblioteca **inteira**, fora do recorte do filtro), para status e nota não
  envelhecerem; em Séries isso é um `buildSeasonGroups` sem filtro, porque o `lookup` da lista só
  tem as séries que passaram nele.
- **Seleção em lote e remover coleção existem só na grade.** No Detalhe, status, nota, capa da
  coleção e remover saem do botão abaixo do palco, que abre o modal de sempre da mídia.

## 3. O palco

O item não é um vídeo, então o palco cai em degraus, sempre na mesma caixa 16:9 (a altura não muda
entre um item com trailer e um sem): **trailer** (`TrailerEmbed`, o mesmo dos drawers) → **imagem**
→ **capa**, inteira e centralizada. Enquanto o detalhe carrega fica a capa, e o título vem da entrada
da biblioteca na hora.

| Mídia | Trailer | Imagem | Subtítulo |
|---|---|---|---|
| Anime | só os do YouTube (`trailer.site`) | banner | estúdios |
| Filmes | `trailerKey` | imagem de fundo | frase (tagline) |
| Séries | `trailerKey` **da série** | imagem de fundo da série | nome da temporada |
| Jogos | `trailer` | banner ou 1ª screenshot | estúdios |

- **O trailer só toca sozinho para um item escolhido nesta visita** (`armed` no hook + escolha igual
  ao item do palco). A tela abre num item que ninguém pediu, e trocar de aba ou de visualização
  desarma — voltar para a tela não é pedir de novo. Cair no primeiro da lista por causa do filtro
  também não toca.
- **O link "Assistir no YouTube ↗" fica na linha de ações**, não embaixo do player
  (`TrailerEmbed` com `externalLink={false}`): colado ao player ele grudaria junto com o palco fixo
  do celular (§8). Nos drawers o link continua embaixo do trailer.
- O `NotesBlock` fica **fora** do ramo de sucesso, com `key` por item: quando o detalhe falha entra
  o aviso de dados salvos e a anotação continua lá.
- **Nenhum invólucro leva `key` por item**, pelo mesmo motivo dos drawers
  (`docs/frontend-drawers.md` §2).

## 4. A lista da direita

Dois níveis em **sanfona**, como o "agrupar por canal" do YouTube — no desktop e no celular:

- **Coleção de 2+ itens** aparece como coleção (capa e título do representante, contagem, nota
  média); clicar **abre a coleção no lugar**, sem trocar o item do palco: os itens entram logo
  abaixo dela, numa lista de dentro (`aria-label` = título da coleção), a seta gira e o bloco vira
  um cartão. Clicar de novo fecha (`aria-expanded` na linha). **Várias podem ficar abertas** e o
  resto da lista não sai do lugar. Uma versão anterior trocava a lista inteira pelos itens da
  coleção, com uma barra "← Todas as coleções"; não volte a isso.
- O hook guarda só o conjunto de chaves (`openGroups` + `onToggleGroup`): coleção que o filtro
  tirou de vista simplesmente não é desenhada, e volta aberta quando reaparece.
- **Coleção de 1 item é o próprio item**: a linha abre direto no palco.
- A contagem da coleção é `count`; com filtro vira `que batem/total`, igual ao selo da grade.
- O destaque (`aria-current`) marca o item aberto; a coleção dele só leva o destaque enquanto está
  **fechada** — aberta, quem aparece marcado é o item dentro dela.
- **Abrir ou fechar uma coleção não rola a lista**: o ajuste de `scrollTop` que traz o destaque
  para a vista só roda ao trocar de item ou de filtro.
- **A miniatura é retrato** (capa/pôster), não a 16:9 do YouTube.
- **Anterior/próximo andam pela coleção do item aberto** (`collectionNav`, a mesma sequência do
  drawer): botões abaixo do palco com a posição, setas sobre o trailer e ← → do teclado (ignoradas
  digitando e com modal aberto — `navKeys`). Item avulso não tem navegação.

## 5. Séries: a coleção são as temporadas

O membro é o `SeasonMember` de `utils/seasonGroups.ts` (ver `docs/frontend-series-temporadas.md`),
então a lista mostra as **séries** e, dentro de uma, as **temporadas**.

- **O título do palco é o da série**, que numa temporada de coleção não está no membro ("Temporada
  2") e sim no representante do grupo. O nome da temporada vai no subtítulo.
- **Os dados são os da série** (trailer, ficha, gêneros, onde assistir — o TMDB não dá trailer por
  temporada); da temporada vêm o pôster, a sinopse e os episódios (`useSeasonDetail` busca as duas).
- **Status, nota e anotação são da temporada**: o botão abre o `SeasonLibraryModal` e a anotação vai
  por `saveSeasonNotes`.
- **Série sem `season_list`** é o único caso em que o item aberto é a própria série: busca só a
  série, sem episódios nem bloco de anotação, e o botão abre o `SeriesLibraryModal`.

## 6. O que não veio do YouTube

Reprodução automática de item em item (trailer não é playlist), o player da IFrame API, mover entre
abas e gravar último acesso ao tocar — `last_access_at` continua dirigido por status.

## 7. Compartilhado com os drawers

Para drawer e visão usarem o mesmo miolo:

- `hooks/useKeyedDetail.ts` guarda o payload junto com a chave a que pertence (trocar de item sem
  remontar); `hooks/useMediaDetail.ts` tem um hook por mídia em cima dele.
- As seções do detalhe são componentes que devolvem um **fragmento** (o espaçamento é de quem
  monta) e aceitam `wide` para a coluna larga: `AnimeDetailSections`, `MovieDetailSections`,
  `SeriesDetailSections` + `SeasonEpisodes`, `GameDetailSections`. Os três primeiros moram na pasta
  do drawer e usam o CSS module dele; o de jogos tem o próprio.

O CSS de layout do `CollectionWatch` repete o do `YoutubeWatch` de propósito: são telas parecidas,
mas a do YouTube tem player e lista próprios.

**Largura** (vale para as duas telas): a tela ocupa a largura toda da página, com a lista em
`--queue-width` (400 px, crescendo até 480 px em tela larga) e o palco com o resto. Não há teto fixo
em pixels — o `max-width` é calculado pela **altura** da janela, só para o palco 16:9 não ficar mais
alto que a tela em monitor ultrawide. Mudou num, mude no outro.

## 8. Celular (≤ 768 px)

Vale igual para o `CollectionWatch` e o `YoutubeWatch` — mudou num, mude no outro. Entre 769 e
1100 px a lista só desce para baixo do palco, sem nada disto.

- **O palco vai de borda a borda e fica fixo no topo** (`.stageSlot`, `position: sticky`) enquanto
  título, ações e lista rolam por baixo. Para isso a tela vira **flex em coluna** e a coluna do
  palco (`.main`) vira `display: contents`: sticky só anda dentro do bloco que o contém, então o
  palco precisa ser filho direto da tela inteira — e item de **grid** fica preso à própria célula,
  daí o flex.
- **Canto e altura do palco são variáveis CSS** lidas por quem desenha a caixa 16:9 (`.stage`,
  `TrailerEmbed`, `YoutubePlayer`): `--stage-radius` (zerado no celular) e `--stage-max-height`
  (50vh com o celular deitado, senão o palco cobriria a tela). Componente novo que entre no palco
  precisa ler as duas.
- **Escolher um item não mexe na rolagem.** O efeito que traz o palco de volta para a vista mede o
  topo do **palco**, não o da tela: fixo, ele nunca sai por cima, então nada rola. Em tela estreita
  sem palco fixo (769–1100 px) continua rolando até ele.
- **Ficha e anotação começam recolhidas**, atrás do botão "Mostrar detalhes" / "Ocultar detalhes"
  (`aria-expanded`). O botão existe sempre no DOM e o estado vale em qualquer largura; é o CSS que
  só mostra o botão e só esconde o bloco no celular. Escondido por `display: none`, o `NotesBlock`
  **continua montado** — texto não salvo não se perde. O estado vale para a visita, não por item, e
  não é salvo.
- O `OfflineBanner` também é sticky no topo e fica por cima da faixa de cima do palco quando
  aparece.
