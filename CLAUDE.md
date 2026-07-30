# CLAUDE.md

Este arquivo orienta o Claude Code (claude.ai/code) ao trabalhar neste repositório.

## Visão geral

**Media Tracker** é um app pessoal full-stack (usuário único, sem auth, online-only) para
acompanhar coleções de mídia. Seis domínios de mídia, cada um com catálogo (busca em API externa)
e biblioteca pessoal (CRUD em PostgreSQL):

- **Anime** — AniList (GraphQL); descoberta de franquia (sequências/OVAs/filmes).
- **Filmes** e **Séries** — TMDB; filmes têm coleções (ex.: trilogias); séries têm nota por
  temporada (coleção de temporadas; nota da série = média).
- **Jogos** — IGDB (auth via Twitch OAuth); coleções/sagas; filtro por modos de jogo (`game_modes`).
- **Livros** — Google Books.
- **YouTube** — vídeos curtidos/salvos (YouTube Data API); modelo à parte (status `liked`/`removed`).
  **Sem coleção**: grade plana, organizada por **tags** (N por vídeo) + filtro de canal.

Recursos transversais: **Dashboard** agregado, **sync de coleções** (descobre e adiciona novos
lançamentos de franquias já concluídas), **notificações no Telegram** (novos episódios, itens de
coleção, lançamentos) via **notify-api** — o app nunca fala com o Telegram diretamente — e
**backup** export/import.

## Comandos de desenvolvimento

Pré-requisito local: PostgreSQL acessível em `127.0.0.1:5432` (banco `media_tracker`). Em dev o
banco fica na VPS; abra um túnel SSH antes: `ssh -L 5432:localhost:5432 lucas@<vps>`. O backend
roda `migrate()` (DDL idempotente) no boot — sem arquivos de migração.

```bash
# backend (hot-reload via tsx)
cd backend && npm run dev        # http://localhost:3333
cd backend && npm run build      # tsc → dist/
cd backend && npm start          # node dist/server.js
cd backend && npm test           # vitest (cache, httpClient, librarySyncService)

# frontend (Vite)
cd frontend && npm run dev       # http://localhost:5173 (proxy /api → :3333)
cd frontend && npm run build     # tsc -b + vite build
cd frontend && npm run lint      # ESLint
cd frontend && npx vitest run    # vitest (useMediaList)
```

Antes de considerar uma mudança pronta: `build` + `lint` passam nos dois lados, e `test` quando
tocar em algo coberto.

## Arquitetura

### Fluxo de dados

```
Browser → Vite dev proxy (ou nginx do container web em prod)
        → Express (server :3333, /api)
        → PostgreSQL
        → APIs externas: AniList / TMDB / IGDB / Google Books / YouTube
        → notify-api :3334 → Telegram (só notificações)
```

### Backend (`backend/src/`)

Padrão em camadas por domínio: `types/` → `models/` (pg puro, mapper snake→camel) → `schemas/`
(Zod) → `controllers/` (`asyncHandler` + Zod, erros `{ error: "msg PT" }`) → `routes/`.

- **`server.ts`** — Express, registra as rotas de cada mídia (`/api/anime`, `/api/library`,
  `/api/movie`, `/api/movie-library`, `/api/series`, `/api/game`, `/api/book`,
  `/api/youtube-library`, `/api/backup`, …), roda `migrate()` e agenda os jobs (abaixo).
- **`lib/` (reutilizáveis — prefira-os a reinventar):**
  - **`createLibraryModel.ts` / `createLibraryController.ts`** — factories que geram o CRUD padrão
    das bibliotecas (findAll/create/update/updateManyStatus/setCover/remove + timestamp de
    conclusão + reset de `is_rewatching`). Movie/series/game/book/youtube adotam por completo;
    anime usa a factory pro CRUD e mantém funções próprias (JSONB, franquia, sync) standalone.
  - **`httpClient.ts`** — wrapper axios com retry (429/5xx, respeita `Retry-After`), cache opcional
    e **rate limiter opt-in** por chamada. **`rateLimiter.ts`** — throttle proativo + pacing por
    header (`X-RateLimit-*`); usado só pelo AniList. **`cache.ts`** — cache em memória com TTL.
  - **`chunk.ts`**, **`singleFlight.ts`** (dedupe de job concorrente), **`igdbAuth.ts`** (token
    Twitch), **`asyncHandler.ts`** (try/catch + `notifyError` + mapeia `AniListError.status`).
- **`services/`** — clientes das APIs externas (`anilistService`, `tmdbService`,
  `tmdbSeriesService`, `igdbService`, `googleBooksService`, `youtubeService`) e a lógica de fundo:
  - **`collectionSyncService.ts`** — para franquias/coleções com item concluído, descobre membros
    faltantes e adiciona como "planejo"; notifica cada novo item.
  - **`librarySyncService.ts`** / **`seriesLibrarySyncService.ts`** — atualizam entradas "stale"
    (episódios/status) e disparam notificações de novo episódio/finalização.
  - **`releaseLibrarySyncService.ts`** — o mesmo para filmes/jogos, que não têm episódio: TTL de
    12 h para `UPCOMING` (pega adiamento de data) e 7 dias para `RELEASED`. Filmes vão 1 requisição
    por item (o TMDB não tem lote) e por isso têm teto por execução; jogos vão em lote na IGDB.
  - **`releaseNotifyService.ts`** — avisa lançamentos de filmes/jogos.
  - **`notifyService.ts`** — envia ao Telegram via notify-api; nunca lança.
- **Jobs (agendados em `server.ts`):** refresh de anime, séries, filmes e jogos **no boot e a cada
  30 min** (`runSyncTick`; rodar na subida evita deixar tudo parado meia hora após um restart —
  todos são `singleFlight`, então execução longa não se sobrepõe ao tick seguinte);
  **collection sync** diário (04:00); **notificação de lançamentos** diária (09:00). No boot roda
  também `backfillGameModes` (one-shot): preenche `game_modes` dos jogos com a coluna NULL via
  `fetchGameModes` (IGDB) — idempotente (`NULL` = nunca buscado; `[]` = sem modo conhecido). E
  `backfillSeriesSeasons` (one-shot): preenche `season_list` das séries com a coluna NULL via
  `fetchSeriesById` (TMDB). O refresh de séries também atualiza `season_list` (pega novas
  temporadas), sem tocar em `season_scores`.
- **`docs/sincronizacao.md`** detalha todos os jobs (gatilho, condição de staleness, colunas
  gravadas, custo estimado) e as limitações conhecidas. Consulte antes de mexer em job.
- **Invariantes do refresh:**
  - Cada job grava o mesmo conjunto de campos que o `handle*Load` da página grava ao abrir o
    drawer — inclusive **título e capa**, que antes só mudavam por lá e por isso envelheciam.
    Título/capa usam `COALESCE(NULLIF(...))` no `UPDATE`: resposta com campo vazio (TMDB pt-BR
    devolve `poster_path` nulo às vezes) não pode apagar um valor bom.
  - **Nada de fan-out ilimitado nem try/catch por execução.** Onde a API é 1 requisição por item
    (TMDB), o lote vai fatiado com concorrência fixa; onde aceita lote (AniList, IGDB), a iteração
    é por lote. O `try/catch` fica **dentro** da unidade (item ou lote), nunca em volta do job
    inteiro: um item ruim não pode custar o ciclo dos outros. Vale lembrar que qualquer coluna
    nova que entre num `findStale*` torna a biblioteca inteira stale de uma vez.

### Frontend (`frontend/src/`)

- **`App.tsx`** — BrowserRouter + Sidebar; páginas `Dashboard`, `Anime`, `Movies`, `Series`,
  `Games`, `Books`, `YouTube`, `Settings`.
- **Componentes compartilhados**: `MediaCard`/`MediaGrid` (catálogo — e a **biblioteca do YouTube**,
  que não tem coleção: aceita `gridClassName` e `extraActions`, ações extra repassadas à
  `SelectionBar` com os ids selecionados), `FranchiseGrid` (biblioteca agrupada por
  franquia/coleção), `LibraryModalBase` (seletor de status derivado do mapa de labels
  de cada mídia), `LibraryControls` (barra de biblioteca: busca + botões Filtros/Ordenação com painel
  que é bottom-sheet no mobile e popover ancorado no desktop + chip de contagem; dirigido por config
  `filterGroups`/`sort`, cada página monta a config do seu estado. As opções de filtro ficam em
  **grade** (`.filterOptions`), não em `flex-wrap`: com rótulos de larguras diferentes o wrap
  desalinhava as linhas; rótulo longo trunca com reticências e o texto inteiro vai no `title`; o
  grupo de opções em si é o `FilterCheckboxGroup` — `layout="grid"` (default) alinha as colunas,
  `layout="wrap"` põe uma opção do lado da outra e quebra a linha, para rótulos curtos; `count` por
  opção; grupo com mais de 12 opções rola dentro de si, porque o painel não tem teto de altura. Uma
  **única busca de opções** fica no topo do painel, abaixo do "Limpar tudo", e filtra **todos** os
  grupos de uma vez (aparece a partir de 10 opções somando os grupos; grupo sem casamento sai inteiro).
  O painel tem `panelWidth`: `"wide"` fixa no teto de 560 px, `"fit"`
  cresce com o conteúdo até esse teto — `max-content`, porque o painel é absoluto dentro do botão e o
  shrink-to-fit resolveria pela largura dele),
  `NotesBlock` (bloco de anotação livre no fim do `content` dos drawers: textarea auto-grow com
  autosave por debounce de 1 s + flush no unmount, já que fechar o drawer desmonta antes do timer).
  Config visual por mídia em **`config/cards.tsx`**.
- **Anotações**: o drawer não conhece a biblioteca (recebe só o ID externo e busca na API externa),
  então `notes`/`onNotesChange` são props **opcionais** que a página passa só quando acha a entry —
  é isso que esconde o bloco no catálogo. Séries são a exceção: a anotação é da **temporada**
  (`SeasonDrawer` → `saveSeasonNotes` → `PUT /:id/seasons/:n/notes`, endpoint separado do
  `saveSeason`, que exige status/nota válidos); o `SeriesDrawer` não tem bloco.
- **Filtros/ordenação da biblioteca — lógica com base em coleções (invariantes):**
  - **Agrupamento**: `buildCollectionGroups` agrupa por franquia/coleção/autor; cada grupo tem
    `representative` (capa: `isCover` senão o mais antigo), `members`, `count`, `completedCount`. Os
    `build*CollectionGroups` só **agrupam** (não ordenam).
  - **Filtro reduz a coleção (mas o total não muda)**: os filtros de status são **multi-seleção**
    (arrays) e viram um `memberFilter` passado ao builder **só quando há filtro ativo** — ele reduz a
    **capa** e a **expansão** (`members`) aos que batem. O badge é `completedCount/count`: o
    **denominador `count` é SEMPRE o total da coleção** (não muda com filtro); o **numerador**
    (`completedCount`, hoje = **quantidade mostrada**, não mais "concluídos") é o total quando **sem
    filtro** e a **qtde que bate** quando há filtro. Ex.: coleção de 6 → sem filtro `6/6`; filtro
    "planejo" → `3/6` (expansão mostra só esses 3, capa vira um deles). Coleção sem match some. Sem filtro (array vazio):
    `memberFilter` fica `undefined`, mostra tudo (inclusive `dropped`), escondendo só coleções 100%
    `dropped` (`.filter(some não-dropped)` na página). `filterGroupsBySearch` continua por título.
  - **Grupos de filtro por mídia** (todos member-level e combinados em **E** entre si, **OU** dentro
    de cada um): anime = Status + **Exibição** (`animeStatus`, 3 estados); filmes = Status +
    **Lançamento** (`movieStatus`); jogos = Status + **Lançamento** (`gameStatus`) + Modos de jogo;
    livros não têm o de lançamento (YouTube não usa esse pipeline — ver abaixo).
    **Séries é a exceção**: o de Exibição é da série, não da
    temporada (o TMDB não dá status de exibição por temporada), então recorta a lista de entries
    **antes** do `buildSeasonGroups`, enquanto o de Status segue member-level. O mapeamento
    `air_status` cru → `on_air`/`finished`/`upcoming` fica em `utils/seriesFormat.ts`.
  - **Ordenação (de seleção única, `hooks/useSingleSort.ts`; sempre uma ativa)** opera sobre o grupo
    **já reduzido**, via `utils/sortGroups.ts`: **data** = item **mais antigo** da coleção
    (`sortGroupsByMemberDate`, `agg:"oldest"`); **nota** = **média** das notas dos membros com
    `score>0` (`sortGroupsByAvgScore`). Exceção: Livros "Leitura" usa a data de
    leitura **mais recente** (`agg:"latest"`). Avulsos contam como coleção de 1.
  - Padrões: anime/filmes/jogos = Lançamento(desc)+Nota; séries idem; livros =
    Publicação(desc)+Leitura+Nota.
  - **Capa é só coleção (anime/filmes/séries/jogos; prop `coverIsCollectionOnly` do
    `FranchiseGrid`/`FranchiseCard`, que livros NÃO passa)**: em grupo com 2+ itens a capa
    exibe apenas a **média** e o clique **expande/recolhe** em vez de abrir o drawer do representante
    (que segue acessível como membro da expansão, já que `buildCollectionGroups` inclui o
    representante em `members`). O `MediaCard` recebe `isCollectionCover` e some com **tudo que é
    estado de item**: botão de status, badge de exibição/lançamento e o 🔁 de reassistindo — na
    coleção esse estado é dos membros, e o representante é só quem empresta a capa. O topo assim
    liberado é ocupado pela contagem `mostrados/total` do `FranchiseCard` (classe `.badgeTop`).
    **Grupo de 1 item é card simples normal**: botão de status (status/nota/remover) + drawer no
    clique. Como `count` é o total **não filtrado**, um grupo de 2+ reduzido a 1 pelo filtro
    continua sendo coleção.
  - **Séries = coleção de temporadas** (`utils/seasonGroups.ts`, `buildSeasonGroups`): a coleção
    NÃO vem de linhas do banco — cada série é **1 linha** e os membros (temporadas) são sintetizados
    do JSONB `season_list` (metadado) + `season_states` (estado do usuário por temporada:
    `{status,score,isRewatching,notes}`). **Cada temporada se comporta como um filme da coleção**: card com
    botão de status colorido + nota própria. Representante = a série (nome + capa: pôster da temporada
    `cover_season`, senão da série), sujeito à regra `coverIsCollectionOnly` acima. Nos
    membros: clique na **imagem** → `SeasonDrawer`, que traz **os dados da série** (banner, trailer,
    gêneros, onde assistir, grade de 5 infos — corpo compartilhado `SeriesDrawer/SeriesDetailBody.tsx`,
    com overrides de pôster/tagline/sinopse da temporada) **+ a lista de episódios** (`GET
    /api/series/:id/season/:n`); clique no **botão de status** →
    `SeasonLibraryModal` (`LibraryModalBase`, status/nota/reassistindo + "Definir como capa"; `onSetCover`
    e `onRemove` são opcionais — temporada de coleção não se remove sozinha) → `saveSeason`
    (`PUT /:id/seasons/:n`, `setSeasonState` recalcula `score` da série =
    média das notas > 0) e `setCoverSeason` (`PUT /:id/cover-season/:n`). `setSeasonState` **mescla**
    no estado atual da temporada em vez de substituí-lo: o modal não manda a anotação e não pode
    apagá-la. A coluna `score` de
    `series_library` é **sempre** a média das temporadas — nunca uma nota própria: antes das
    temporadas o modal da série tinha campo Nota, e essas notas legadas viravam "nota fantasma" em
    série sem temporada avaliada. Por isso a nota exibida vem de `seasonGroups` + `averageScore`
    (nunca de `entry.score`) e o `migrate()` zera `score` de linha com nota mas sem temporada
    avaliada (roda a cada boot; só bate em linha inconsistente). Filtro de status age **por
    temporada** (member-level, como filmes; esconde só séries 100% dropadas quando sem filtro); sem
    seleção/bulk. Remover a série = lixeira do `FranchiseCard`. Dois casos **não** são coleção (card
    simples, sem `getCollectionKey`): série de **1 temporada** (`isOnlySeason` — card mostra nome/capa
    da série mas carrega o estado da temporada; botão de status abre o `SeasonLibraryModal` **com
    remover** (remove a série) e **sem** "definir como capa") e série **sem `season_list`** (fallback de
    1 membro `kind:"series"`: botão de status → `SeriesLibraryModal`, imagem → `SeriesDrawer`).
    `store.mutate` = primitivo de update otimista
    com endpoint custom (usado por `saveSeason`/`setCoverSeason`).
  - `hooks/useDismiss.ts` centraliza Escape + scroll-lock (mobile) dos painéis.
- **YouTube é a exceção: não tem coleção.** A biblioteca é uma **grade plana** (`MediaGrid`) e toda a
  organização é **tag**. Nada de `buildCollectionGroups`/`sortGroups`/capa/expansão nessa página; o
  pipeline é `useMemo` sobre as entries: aba de status → busca (título/canal) → filtros → comparador
  plano.
  - **Tags**: `tags TEXT[]` (`[]` = sem tag), **N por vídeo**. Vocabulário derivado dos próprios dados,
    sem tabela. Mais o `channelTitle`, que já vinha da API.
  - **O filtro é por sugestão progressiva de tag** (`TagFilterBar/`), **não** por painel: **não existe
    o botão "Filtros"** nessa página (`filterGroups={[]}` faz o `LibraryControls` esconder só ele e
    manter busca, Ordenação e contagem) e **não existe filtro de canal** — recortar por canal é pela
    busca por texto, que já procura no nome dele.
    - **`TagSuggestionRow` fica fixa acima da busca**: as N tags que mais acompanham as já filtradas.
      Sem filtro, as mais usadas. Clique **adiciona** e a faixa se recalcula com a combinação nova.
    - **`SelectedTagRow` fica abaixo da busca**: as tags filtradas, com **✕ no hover** (e **sempre
      visível em `@media (hover: none)`** — no celular não há hover e não haveria como remover) + botão
      **Limpar**. Cada linha some quando não tem conteúdo.
    - Tags filtradas combinam em **E**: o vídeo precisa ter **todas**.
    - A conta sai do **`tagCounts` sobre o conjunto visível** — ou seja "quantos resultados se eu
      marcar essa tag", com a interseção já aplicada. Por isso **toda tag sugerida tem pelo menos um
      resultado** (não há beco sem saída, e o chip não precisa mostrar contagem), e combinação que
      esgotou as companheiras faz a faixa **desaparecer**. Ordem: contagem desc com **desempate
      alfabético** (sem ele a faixa trocaria de ordem entre renders).
    - Quantas sugerir fica em **Configurações** (`app_setting`, chave `youtube-tag-suggestions`,
      padrão 10).
    - Estado vazio distingue "biblioteca vazia" de "filtro sem resultado".
  - **Ordenação** (`useSingleSort`, padrão Alfabética(asc)): Alfabética, Data e Visualizações.
  - **Chips no card** (`TagChip/CardTags`): linha própria abaixo de duração/views, com **altura fixa de
    2 linhas de chip e `overflow: hidden`** — tag que não cabe fica escondida e o card **nunca cresce**
    (o corte é determinístico porque o chip tem altura fixa; o menu é onde se vê tudo). Ordenados por
    **popularidade** (`tagRank` no contexto — ranking da aba de status, com desempate alfabético), então
    o que o corte esconde é sempre a tag menos relevante. Cor por hash do nome (`utils/chipColor.ts` → tokens `--color-chip-N`),
    então a mesma tag tem sempre a mesma cor. **A linha inteira** abre o menu (um "+" no fim seria
    justamente o que o corte esconde); sem tag, mostra um chip fantasma `+ tags`.
  - **Menu de tag** (`TagPicker`, **em portal** — `MediaCard` tem `overflow: hidden` e clipa menu
    absoluto): multi-seleção **em ordem alfabética** (é a lista para varrer; o ranking ordena o card,
    não o menu) com **campo de busca que acumula os dois papéis**, filtrar e criar — "Criar «x»" só
    aparece quando não há casamento exato. **Navegável por ↑/↓ com Enter escolhendo o item sob o
    cursor** (o "Criar" é o primeiro da sequência; o hover move o cursor, para não haver dois
    destaques); o cursor é **clampado em render**, já que a lista encurta enquanto se digita.
    Reposiciona no scroll em vez de fechar (fechar matava a
    rolagem da própria lista e o texto sendo digitado), e **barra a propagação de tecla, menos Escape**:
    evento de portal sobe pela árvore React, então o Enter da busca chegava no `onKeyDown` do
    `MediaCard` e abria o drawer; Escape tem que passar para o `useDismiss` fechar. Lê tudo do
    `youtubeTagContext`, que evita arrastar callback até o `renderBelow` (ele só recebe o item).
  - **Sugestão de tag por coocorrência** (`TagSuggestions`, faixa acima do menu, só com ele aberto):
    as **4 tags que mais aparecem nos vídeos que têm TODAS as tags atuais** do vídeo (interseção, não
    união), por contagem desc com desempate alfabético — sem desempate a sugestão trocaria de lugar
    entre renders. `recommendFor([])` **degenera na contagem global** (o `every` sobre lista vazia é
    verdadeiro para todos), então vídeo sem tag sugere as mais usadas sem ramo próprio. Clicar adiciona
    e a faixa **se recalcula** com a combinação nova; sem nada a sugerir (combinação que nenhum outro
    vídeo tem) a faixa **desaparece**, em vez de cair para um fallback não relacionado. Escopo é a aba
    de status, como o ranking. Contado em memória sobre o store — sem endpoint.
  - **Posição do portal**: a pilha (faixa + menu) é ancorada por `top` abrindo para baixo e por
    **`bottom`** quando não há espaço embaixo. Ancorar o rodapé é o que deixa a faixa crescer para cima
    **sem medir a altura dela** — e tirou o palpite de altura que o cálculo de flip usava antes.
  - **Em lote** pelas `extraActions` da `SelectionBar` → `TagBulkModal` com dois modos:
    **Adicionar tag** (`POST /bulk-add-tag`) e **Remover tag** (`POST /bulk-remove-tag`) — com N tags
    "definir" não faria sentido. No modo remover só são oferecidas as tags que os selecionados têm.
  - **Playlist importada** entra com o nome dela como tag; o `ON CONFLICT` só aplica em vídeo que ainda
    não tem tag nenhuma, para reimportar não atropelar ajuste manual.
  - Os modelos anteriores do YouTube (coleção com capa/expansão, tag única escopada à coleção, e o par
    categoria/subcategoria) foram **removidos** — colunas, tabela `youtube_collection` e rotas
    `/collections*` inclusive. O `migrate()` dropa o que sobrou; **a coluna sai antes da tabela**,
    senão a FK barra o `DROP TABLE`.
- **`hooks/useMediaList.ts`** — estado de catálogo com paginação, cache por chave, `AbortController`
  (cancela busca anterior) e `reset()`. Um `useLibrary`-like por mídia para o CRUD com estado local
  otimista.
- **`utils/`** — `buildFranchiseGroups`/`build*CollectionGroups` (agrupam + `memberFilter`),
  `sortGroups.ts` (ordenações por coleção) e `filterGroupsBySearch` montam a lista da biblioteca;
  envolver o pipeline em `useMemo`. Ver invariantes de filtro/ordenação por coleção acima.

### Esquema do banco (uma tabela por mídia)

`anime_library`, `movie_library`, `series_library`, `game_library`, `books_library` (plural),
`youtube_library`. Colunas em `TEXT`/`JSONB`, sem CHECK de enum (migração de status = `UPDATE`).
Convenções comuns (todas **menos `youtube_library`**, que não tem coleção): `is_cover` (capa da
coleção), `is_rewatching`, timestamp de conclusão (`watched_at`/`finished_at`/`read_at`), coluna de
coleção (`franchise_id`/`collection_id`) e `notes`
(`TEXT`, anotação livre do usuário; `NULL` = nunca anotado) — este **menos em `series_library`**, onde
a anotação é por temporada, dentro de `season_states`.
`series_library` tem ainda `season_list` (JSONB, metadado das temporadas do TMDB), `season_states`
(JSONB, estado por temporada `{ "1": {status,score,isRewatching,notes} }`; `score` da série = média das notas)
e `cover_season` (INTEGER, temporada usada como capa da coleção). `game_library` tem `game_modes`
(`TEXT[]`). `youtube_library` tem `tags` (`TEXT[] NOT NULL DEFAULT '{}'`, N tags por vídeo, `[]` = sem
tag — ver a exceção do YouTube acima) e **não tem coluna de coleção nem `is_cover`**. Colunas JSONB são
escritas com `JSON.stringify` explícito (ver `seriesLibraryModel`); `TEXT[]` vai como **array JS
direto** (ver `game_modes` e `tags`).

Fora das mídias existe **`app_setting`** (`key TEXT PK`, `value JSONB`): preferência de UI persistida
no banco, para valer em qualquer dispositivo. Lida/gravada por `GET`/`PUT /api/settings/:key` e, no
front, pelo hook genérico `useAppSetting(key, fallback)` — chave inexistente responde 404 e o hook cai
no fallback. Hoje guarda só `youtube-tag-suggestions` (quantas tags a faixa de filtro sugere).

**Status vindos da API externa** (todos alimentados pelos jobs de refresh, nunca editáveis pelo
usuário): `anime_status` (AniList: `RELEASING`/`FINISHED`/`NOT_YET_RELEASED`) e, em filmes/séries/
jogos, `movie_status`/`series_status`/`game_status`, que são só `RELEASED`/`UPCOMING` derivados da
data. Séries têm além disso `air_status` — o status cru do TMDB (`Returning Series`/`Ended`/…),
que é o que dá os três estados do filtro de Exibição; `NULL` = nunca sincronizado, e é o que faz
o `findStaleSeries` puxar a linha para backfill. `synced_at` (todas as quatro tabelas) guarda o
último refresh; `NULL` entra na próxima execução do job.

**Status da biblioteca:** `plan_to_*` (planejo) → concluído (`watched`/`beaten`/`read`) →
`dropped`. Não existe status "em progresso". YouTube usa `liked`/`removed`.

## Convenções

- **Idioma**: código (variáveis, tipos, arquivos) em inglês; textos ao usuário (erros de API, UI)
  em português.
- **TypeScript strict** nos dois lados, sem `any`. Backend `module: NodeNext` → **imports com
  extensão `.js`**. Frontend `moduleResolution: bundler` → sem extensão.
- **Estilo**: CSS Modules por componente, sem libs de UI. Sempre usar os tokens de
  `styles/global.css` (tema dark), **nunca** hardcode de cores/tamanhos.
- **Estado**: só hooks do React (`useState`/`useContext`/`useReducer`) — sem Redux/Zustand.
- **Sem comentários no código**, exceto quando registram uma restrição não óbvia.
- **HTTP**: `201` create, `204` delete, `400` validação, `404` not found, `409` conflito
  (`anilist_id`/id externo duplicado), `500` erro.

## Integrações externas

- **AniList** (`https://graphql.anilist.co`, POST, sem auth) — limite documentado 90 req/min, mas
  na prática degradado (~30/min). Todo tráfego passa por `queryAniList`, que aplica o
  `rateLimiter` (throttle ~2s + pacing por header) e normaliza erros em `AniListError` (a AniList
  responde HTTP 200 com `{ errors, data:null }` em erro de validação; 404 vira 404). Estações:
  meses 1–3 WINTER, 4–6 SPRING, 7–9 SUMMER, 10–12 FALL. `MEDIA_FIELDS` é compartilhado com as
  listagens — campo pesado vai só na query do `fetchAnimeById` (é o caso de `stats` e de
  `streamingEpisodes`, que alimenta a lista de episódios do `AnimeDrawer` e vem vazia para anime sem
  streaming licenciado).
- **TMDB** (filmes/séries), **IGDB** (jogos, via token Twitch em `igdbAuth`), **Google Books**,
  **YouTube Data API** — chaves em env.
- **notify-api** (Telegram) — gateway compartilhado; o app só envia (texto/campos/botões).

## Variáveis de ambiente

Backend (`backend/.env`, copiar de `backend/.env.example`):
`DATABASE_URL`, `PORT` (3333), `TMDB_API_KEY`, `GOOGLE_BOOKS_API_KEY`, `IGDB_CLIENT_ID`,
`IGDB_CLIENT_SECRET`, `YOUTUBE_API_KEY`, `NOTIFY_API_URL`, `NOTIFY_API_KEY`.

Docker (`.env` na raiz, copiar de `.env.example`): `POSTGRES_USER/PASSWORD/DB`, `MEDIA_DOMAIN`,
as chaves das APIs externas e `NOTIFY_API_KEY`.

## Produção (Docker) e proxy

Stack `media-tracker` (`docker-compose.yml`): `postgres` (banco dedicado, volume), `server`
(Express/API) e `web` (nginx: serve o build do frontend e faz proxy de `/api` → `server:3333`). O
domínio é roteado pelo **proxy reverso central Caddy** (`caddy-docker-proxy`, stack `./proxy`,
compartilhado por todos os projetos da VPS): `web` entra na rede externa `proxy-net` com labels
`caddy: ${MEDIA_DOMAIN}` e o Caddy termina o TLS — por isso `web` não expõe porta no host. A
notify-api se pluga na rede `media-net`.

```bash
docker network create media-net    # uma vez na VPS (compartilhada com a notify-api)
docker network create proxy-net    # uma vez na VPS (proxy central)
docker compose up --build -d        # https://${MEDIA_DOMAIN} pela VPN
```

## Fluxo de trabalho

- Para tarefas que envolvam mais de um arquivo, apresente um plano e aguarde aprovação antes de editar.
- Tarefas simples (1 arquivo, mudança pequena) pode executar direto.

## Manutenção deste arquivo

- Quando uma mudança tornar algo aqui factualmente incorreto (módulo/arquivo renomeado ou
  removido, comando alterado, nova integração, novo invariante ou gotcha), atualize a linha
  afetada na mesma tarefa.
- Edite no lugar e remova o que ficou obsoleto — este arquivo não cresce sem contrapartida.
  Prefira descrever padrões/invariantes estáveis a listar arquivos.
- Documente fatos, não preferências. Não adicione convenções ou "boas práticas" novas por conta
  própria: proponha e deixe a decisão de estilo comigo.
- Mantenha conciso e em português.
