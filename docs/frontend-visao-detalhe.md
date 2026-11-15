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
- **`useLibraryWatch(storageKey, groups, active)`** guarda o estado na página: a visualização
  (`localStorage`, uma chave por mídia — `anime-library-view`, `movies-library-view`,
  `series-library-view`, `games-library-view`; ausente = grade), o item escolhido, a coleção aberta
  e se o trailer está armado. Devolve `entry` (o item do palco) e `props`, que a página espalha no
  invólucro.

## 2. O que é da página

- A visão só vale na aba **Minha Biblioteca** — catálogo é sempre grade com drawer.
- **A lista são os mesmos grupos da grade**: filtros, busca e ordenação da `LibraryControls` valem
  igual, e os invariantes de `docs/frontend-colecoes.md` continuam (o filtro decide quais coleções
  aparecem; a coleção aberta mostra **todos** os membros). Por isso os filtros ficam na barra do
  topo, não dentro do painel.
- **Não há rota por item**: o item aberto é estado (a `id` do membro). O que está no palco é
  derivado por `pickWatchEntry`: o escolhido enquanto a coleção dele estiver na tela, senão o
  **primeiro item da primeira coleção** — sem efeito para consertar a escolha quando o filtro muda.
  Sem item para mostrar (vazio, carregando, filtro sem resultado) `entry` vem vazio e a página cai
  na grade, que já tem esses estados.
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
- O `NotesBlock` fica **fora** do ramo de sucesso, com `key` por item: quando o detalhe falha entra
  o aviso de dados salvos e a anotação continua lá.
- **Nenhum invólucro leva `key` por item**, pelo mesmo motivo dos drawers
  (`docs/frontend-drawers.md` §2).

## 4. A lista da direita

Dois níveis, como o "agrupar por canal" do YouTube:

- **Coleção de 2+ itens** aparece como coleção (capa e título do representante, contagem, nota
  média); clicar **abre a coleção na lista**, sem trocar o item do palco. Aberta, mostra os itens
  dela com a barra de saída fora da área que rola. Coleção que o filtro tirou de vista deixa de
  estar aberta por derivação (o hook guarda só a chave).
- **Coleção de 1 item é o próprio item**: a linha abre direto no palco.
- A contagem da coleção é `count`; com filtro vira `que batem/total`, igual ao selo da grade.
- O destaque (`aria-current`) marca o item aberto ou, na lista de coleções, a coleção dele.
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
