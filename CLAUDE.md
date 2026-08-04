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
- **Livros** — Hardcover (GraphQL); coleções por **série** (`featured_series`), com dedupe
  obrigatório e trava de autor.
- **YouTube** — vídeos curtidos/salvos (YouTube Data API); modelo à parte (status `liked`/`removed`).
  Coleções (tabela própria) e, **dentro de cada uma**, organização por **tags** (N por vídeo).

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
        → APIs externas: AniList / TMDB / IGDB / Hardcover / YouTube
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
    conclusão + `lastAccess`/`touchAccess` — último acesso, ver esquema).
    Movie/series/game/book/youtube adotam por completo;
    anime usa a factory pro CRUD e mantém funções próprias (JSONB, franquia, sync) standalone.
  - **`httpClient.ts`** — wrapper axios com retry (429/5xx, respeita `Retry-After`), cache opcional
    e **rate limiter opt-in** por chamada. **`rateLimiter.ts`** — throttle proativo + pacing por
    header (`X-RateLimit-*`); usado só pelo AniList. **`cache.ts`** — cache em memória com TTL.
  - **`chunk.ts`**, **`singleFlight.ts`** (dedupe de job concorrente), **`igdbAuth.ts`** (token
    Twitch), **`asyncHandler.ts`** (try/catch + `notifyError` + mapeia `AniListError.status`).
- **`services/`** — clientes das APIs externas (`anilistService`, `tmdbService`,
  `tmdbSeriesService`, `igdbService`, `hardcoverService`, `youtubeService`) e a lógica de fundo:
  - **`collectionSyncService.ts`** — para franquias/coleções com item concluído, descobre membros
    faltantes e adiciona como "planejo"; notifica cada novo item.
  - **`librarySyncService.ts`** / **`seriesLibrarySyncService.ts`** — atualizam entradas "stale"
    (episódios/status) e disparam notificações de novo episódio/finalização.
  - **`releaseLibrarySyncService.ts`** — o mesmo para filmes/jogos/livros, que não têm episódio: TTL
    de 12 h para `UPCOMING` (pega adiamento de data) e 7 dias para `RELEASED`. Filmes vão 1 requisição
    por item (o TMDB não tem lote) e por isso têm teto por execução; jogos vão em lote na IGDB e
    livros em lote na Hardcover (`id: {_in: [...]}`) — o de livros passa **sem cache** (o conjunto de
    ids é determinístico, então o cache de 1 h faria o tick seguinte só bumpar `synced_at`).
  - **`releaseNotifyService.ts`** — avisa lançamentos de filmes/jogos/livros.
  - **`notifyService.ts`** — envia ao Telegram via notify-api; nunca lança.
- **Jobs (agendados em `server.ts`):** refresh de anime, séries, filmes, jogos e livros **no boot e a
  cada 30 min** (`runSyncTick`; rodar na subida evita deixar tudo parado meia hora após um restart —
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
- **Componentes compartilhados**: `MediaCard`/`MediaGrid` (catálogo), `FranchiseGrid` (biblioteca
  agrupada por franquia/coleção; aceita `renderExpansion` — inversão de controle da expansão — e
  `extraActions`, ações extra repassadas à `SelectionBar` com os ids selecionados, habilitadas só com
  a seleção numa única coleção), `LibraryModalBase` (seletor de status derivado do mapa de labels
  de cada mídia + linha opcional `lastAccess` — "Última vez assistido/jogado" em data relativa,
  escondida quando nunca houve acesso), `LibraryControls` (barra de biblioteca: busca + botões Filtros/Ordenação com painel
  que é bottom-sheet no mobile e popover ancorado no desktop + chip de contagem; dirigido por config
  `filterGroups`/`sort`/`toggle` (este último é um botão liga/desliga sem painel — hoje o "Último
  acesso"), cada página monta a config do seu estado. O gatilho da **Ordenação é dividido**
  (`onIconClick` do `ControlPopover`): o ícone **inverte a direção** — é ele que a mostra — e o
  rótulo abre o painel; são dois botões irmãos porque `<button>` dentro de `<button>` é inválido,
  mas sem divisor visual (parece uma pílula só). Inverter = reselecionar o critério ativo, que é o
  que o `useSingleSort` já trata como troca de direção. O ícone do **Filtros fica roxo** enquanto
  houver filtro ativo (`iconActive`). As opções de filtro ficam em
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
  - **Agrupamento**: `buildCollectionGroups` agrupa por franquia/coleção; cada grupo tem
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
    `dropped` (`.filter(some não-dropped)` na página). `filterGroupsBySearch` casa por título **do representante ou de
    qualquer membro** — o representante entra por causa das séries, onde os membros são as
    temporadas ("Temporada 1"...) e o nome da série existe só nele.
  - **Grupos de filtro por mídia** (todos member-level e combinados em **E** entre si, **OU** dentro
    de cada um): anime = Status + **Exibição** (`animeStatus`, 3 estados); filmes = Status +
    **Lançamento** (`movieStatus`); jogos = Status + **Lançamento** (`gameStatus`) + Modos de jogo;
    livros = Status + **Lançamento** (`bookStatus`); YouTube tem só **Coleção**, e o resto do recorte
    é por tag dentro da expansão (ver abaixo).
    **Séries é a exceção**: o de Exibição é da série, não da
    temporada (o TMDB não dá status de exibição por temporada), então recorta a lista de entries
    **antes** do `buildSeasonGroups`, enquanto o de Status segue member-level. O mapeamento
    `air_status` cru → `on_air`/`finished`/`upcoming` fica em `utils/seriesFormat.ts`.
  - **Ordenação (de seleção única, `hooks/useSingleSort.ts`; sempre uma ativa)** opera sobre o grupo
    **já reduzido**, via `utils/sortGroups.ts`: **data** = item **mais antigo** da coleção
    (`sortGroupsByMemberDate`, `agg:"oldest"`); **nota** = **média** das notas dos membros com
    `score>0` (`sortGroupsByAvgScore`). Exceção: Livros "Leitura" usa a data de
    leitura **mais recente** (`agg:"latest"`). Avulsos contam como coleção de 1.
  - **A expansão de livros ordena por `series_position`**, não por data: é o único caso em que a
    ordem dos membros vem de um campo **guardado** da API (a posição na série da Hardcover, com
    meio-valor real — 0.5 para conto, 3.5 para novela). É a ordem de leitura, e por isso a posição
    vence a data de publicação (em Hunger Games o prequel é posição 0 e o mais recente). Posição
    nula vai para o fim, e `reverseMembers` fica `false` (as outras mídias invertem).
  - **Último acesso é derivado na coleção, nunca guardado**: o valor do grupo é o **mais recente**
    entre os membros (`latestAccess` em `utils/lastAccess.ts`; ordenação "Último acesso" =
    `sortGroupsByMemberDate(..., lastAccessTimeOf, agg:"latest")`, com nunca acessado valendo 0). É o
    que faz item que entra numa coleção passar a compor o máximo dela e, ao sair, voltar a valer por
    si — sem escrita nem sincronização. Mesmo espírito da nota, que é a média dos membros.
  - **A data no card é opt-in**: o botão "Último acesso" da barra (`showLastAccess`, propagado até o
    `MediaCard`) revela um chip em **todos** os cards — capa, membros da expansão e avulsos. Por
    padrão nada aparece: o card já carrega título, ano, status e nota. O chip entra **dentro do
    overlay**, acima do título (não cobre nada), e **flutua** no canto de baixo da imagem quando a
    mídia não tem overlay (YouTube, que descreve o vídeo abaixo da imagem). Cor por faixa
    (`lastAccessTone`): até 1 ano, 1–5 anos, 5+ anos e nunca — as mesmas faixas que o filtro por
    tempo vai usar.
  - Padrões: anime/filmes/jogos = Lançamento(desc)+Nota; séries idem; livros =
    Publicação(desc)+Leitura+Nota+Último acesso.
  - **Capa é só coleção (todas as mídias com coleção; prop `coverIsCollectionOnly` do
    `FranchiseGrid`/`FranchiseCard`)**: em grupo com 2+ itens a capa
    exibe apenas a **média** e o clique **expande/recolhe** em vez de abrir o drawer do representante
    (que segue acessível como membro da expansão, já que `buildCollectionGroups` inclui o
    representante em `members`). O `MediaCard` recebe `isCollectionCover` e some com **tudo que é
    estado de item**: botão de status e badge de exibição/lançamento — na
    coleção esse estado é dos membros, e o representante é só quem empresta a capa. O topo assim
    liberado é ocupado pela contagem `mostrados/total` do `FranchiseCard` (classe `.badgeTop`).
    **Grupo de 1 item é card simples normal**: botão de status (status/nota/remover) + drawer no
    clique. Como `count` é o total **não filtrado**, um grupo de 2+ reduzido a 1 pelo filtro
    continua sendo coleção.
  - **Séries = coleção de temporadas** (`utils/seasonGroups.ts`, `buildSeasonGroups`): a coleção
    NÃO vem de linhas do banco — cada série é **1 linha** e os membros (temporadas) são sintetizados
    do JSONB `season_list` (metadado) + `season_states` (estado do usuário por temporada:
    `{status,score,notes,lastAccessAt}`). **Cada temporada se comporta como um filme da coleção**: card com
    botão de status colorido + nota própria. Representante = a série (nome + capa: pôster da temporada
    `cover_season`, senão da série), sujeito à regra `coverIsCollectionOnly` acima. Nos
    membros: clique na **imagem** → `SeasonDrawer`, que traz **os dados da série** (banner, trailer,
    gêneros, onde assistir, grade de 5 infos — corpo compartilhado `SeriesDrawer/SeriesDetailBody.tsx`,
    com overrides de pôster/tagline/sinopse da temporada) **+ a lista de episódios** (`GET
    /api/series/:id/season/:n`); clique no **botão de status** →
    `SeasonLibraryModal` (`LibraryModalBase`, status/nota + "Definir como capa"; `onSetCover`
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
- **YouTube = coleção + tag escopada à coleção.** A biblioteca é `FranchiseGrid` como as outras
  (capa/expansão, `buildYoutubeCollectionGroups` + `sortGroups`), mas a organização **dentro** de cada
  coleção é por **tag**. Pipeline em `useMemo`: agrupa → filtro de coleção → `applyStatusView` (aba
  de status) → busca (título/canal) → ordenação por grupo. Ordenação (`useSingleSort`, padrão
  Alfabética(asc)): Alfabética, Data e Visualizações. **Vídeo avulso vem sempre antes das coleções**
  (`standaloneFirst`, aplicado depois da ordenação), em qualquer critério e direção — a ordenação
  escolhida vale dentro de cada bloco. Abrir o drawer do vídeo **registra acesso**
  (`registerAccess` → `POST /:id/access`, otimista; `key` por vídeo no drawer, que grava na montagem)
  — ver `last_access_at` no esquema.
  - **Invariante central: tag só existe dentro de coleção.** Vídeo avulso tem `tags = '{}'` e **não
    mostra nem a linha de chips**. Sair da coleção (`removeFromCollection`) **e trocar de coleção**
    (`assignCollection`, `CASE WHEN collection_id IS DISTINCT FROM`) zeram as tags — o vocabulário é
    da coleção de origem e não significa nada na de destino. A regra é firmada em três camadas:
    `UPDATE ... WHERE collection_id IS NULL AND cardinality(tags) > 0` a cada boot no `migrate()`,
    `AND collection_id IS NOT NULL` nos endpoints de tag em lote, e um wrapper no `update` do
    controller que descarta `tags` do payload de vídeo avulso.
  - **Tags**: `tags TEXT[]` (`[]` = sem tag), **N por vídeo**. Vocabulário derivado dos próprios
    dados, sem tabela. Contado **por coleção** (`byCollection` na página → `youtubeTagContext`):
    `allTagsFor`, `rankFor` e `recommendFor` recebem todos o `collectionId`. A mesma palavra em duas
    coleções são dois vocabulários independentes.
  - **O filtro de tag vive dentro da expansão**, via `renderExpansion` do `FranchiseGrid` — inversão
    de controle: a página decide o que vai antes dos cards e **quais membros** volta para o
    `renderMembers`. É isso que faz o filtro reduzir **só a expansão**: a capa e o badge
    `mostrados/total` não o enxergam. Estado em `Record<group.key, string[]>` (o `expandedKey` é do
    `FranchiseGrid`; chavear por grupo evita espelhá-lo, e reabrir devolve o filtro onde estava).
    - `TagSuggestionRow` acima e `SelectedTagRow` abaixo (✕ no hover, e **sempre visível em
      `@media (hover: none)`** — no celular não há hover e não haveria como remover). Cada linha some
      quando não tem conteúdo. O wrapper `.expansionFilter` tem `grid-column: 1 / -1`: a expansão é
      grid e sem isso a faixa viraria mais uma coluna.
    - Tags filtradas combinam em **E**: o vídeo precisa ter **todas**.
    - **"Sem tag"** (`NO_TAG`, pseudo-tag sentinela em `TagFilterBar/noTag.ts`) é o único recorte que
      o E não alcançaria — vídeo sem tag nunca casa com tag alguma. Entra **no fim** da faixa de
      sugestão (não disputa slot com o limite; antes das tags mentiria sobre a ordem por contagem) e
      só **sem filtro ativo**, quando há membro sem tag. É **exclusivo**: clicar zera o resto, e com
      ele ativo a faixa de sugestão desaparece por não ter companheira — mesmo caminho da combinação
      que esgota as tags, sem ramo próprio. Chip de estilo **neutro** (borda tracejada), fora da cor
      por hash: ausência de tag não deve se passar por uma do vocabulário.
    - A contagem sai do conjunto **já visível da coleção** — "quantos resultados se eu marcar essa
      tag", com a interseção aplicada. Por isso **toda tag sugerida tem pelo menos um resultado** (não
      há beco sem saída, e o chip não precisa mostrar contagem), e combinação que esgotou as
      companheiras faz a faixa **desaparecer**. Ordem: contagem desc com **desempate alfabético** (sem
      ele a faixa trocaria de ordem entre renders).
  - **No topo**, o `LibraryControls` tem o grupo de filtro **Coleção** (com "Sem coleção") + busca +
    Ordenação. **Não existe filtro de canal** — recortar por canal é pela busca por texto, que já
    procura no nome dele.
  - **Chips no card** (`TagChip/CardTags`): linha própria abaixo de duração/views, com **altura fixa de
    2 linhas de chip e `overflow: hidden`** — tag que não cabe fica escondida e o card **nunca cresce**
    (o corte é determinístico porque o chip tem altura fixa; o menu é onde se vê tudo). Ordenados por
    **popularidade** (`rankFor(collectionId)`, com desempate alfabético), então
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
    as **4 tags que mais aparecem nos vídeos da coleção que têm TODAS as tags atuais** do vídeo
    (interseção, não união), por contagem desc com desempate alfabético — sem desempate a sugestão
    trocaria de lugar entre renders. `recommendFor(id, [])` **degenera na contagem da coleção** (o
    `every` sobre lista vazia é verdadeiro para todos), então vídeo sem tag sugere as mais usadas sem
    ramo próprio. Clicar adiciona e a faixa **se recalcula** com a combinação nova; sem nada a sugerir
    (combinação que nenhum outro vídeo tem) a faixa **desaparece**, em vez de cair para um fallback não
    relacionado. Contado em memória sobre o store — sem endpoint.
  - **Posição do portal**: a pilha (faixa + menu) é ancorada por `top` abrindo para baixo e por
    **`bottom`** quando não há espaço embaixo. Ancorar o rodapé é o que deixa a faixa crescer para cima
    **sem medir a altura dela** — e tirou o palpite de altura que o cálculo de flip usava antes.
  - **Em lote** pelas `extraActions` do `FranchiseGrid` → `SelectionBar` → `TagBulkModal`, com dois
    modos: **Adicionar tag** (`POST /bulk-add-tag`) e **Remover tag** (`POST /bulk-remove-tag`) — com N
    tags "definir" não faria sentido. No modo remover só são oferecidas as tags que os selecionados
    têm. As ações extra só habilitam com os selecionados **numa única coleção e nenhum avulso** —
    coerente com a invariante da tag.
  - **Playlist importada** vira uma **coleção com o nome dela**; o `ON CONFLICT` usa
    `COALESCE(collection_id, EXCLUDED.collection_id)`, então reimportar não rouba vídeo de outra
    coleção.
  - Os modelos anteriores de classificação (tag única escopada à coleção e o par
    categoria/subcategoria) foram **removidos**; o `migrate()` dropa as colunas que sobraram.
- **`hooks/useMediaList.ts`** — estado de catálogo com paginação, cache por chave, `AbortController`
  (cancela busca anterior) e `reset()`. Um `useLibrary`-like por mídia para o CRUD com estado local
  otimista.
- **`utils/`** — `buildFranchiseGroups`/`build*CollectionGroups` (agrupam + `memberFilter`),
  `sortGroups.ts` (ordenações por coleção) e `filterGroupsBySearch` montam a lista da biblioteca;
  envolver o pipeline em `useMemo`. Ver invariantes de filtro/ordenação por coleção acima.

### Esquema do banco (uma tabela por mídia)

`anime_library`, `movie_library`, `series_library`, `game_library`, `books_library` (plural),
`youtube_library`. Colunas em `TEXT`/`JSONB`, sem CHECK de enum (migração de status = `UPDATE`).
Convenções comuns a todas: `is_cover` (capa da
coleção), timestamp de conclusão (`watched_at`/`finished_at`/`read_at`), coluna de
coleção (`franchise_id`/`collection_id`) e `notes`
(`TEXT`, anotação livre do usuário; `NULL` = nunca anotado) — este **menos em `series_library`**, onde
a anotação é por temporada, dentro de `season_states`.

**`last_access_at`** (`TIMESTAMPTZ`; `NULL` = nunca) — última vez assistido/jogado, **distinto do
timestamp de conclusão**, que marca a *primeira* conclusão e é zerado ao sair do status concluído.
Existe em todas as seis mídias. Regras:
- **Só a transição para o status concluído grava.** Salvar de novo mexendo apenas na nota **não**
  mexe na data, e **sair** do status concluído **não limpa** (item abandonado mantém a última vez que
  foi visto) — daí o `ELSE` do `CASE` devolver a própria coluna, ao contrário do `CASE` de conclusão.
- **Consumir de novo algo já concluído é o `touchAccess`** (`POST /:id/access` nas mídias dirigidas
  por status, via `registerAccess` do controller/store): só a data avança, status e nota ficam. Sem
  ele não haveria como registrar a revisita — marcar como concluído o que já está concluído não é
  transição. Na UI é
  o botão "🔁 Assisti/Joguei/Li de novo" do `LibraryModalBase` (prop `again`), que aparece **só** quando
  o status **salvo** já é o concluído: com o seletor mudado sem salvar, quem grava é o próprio Salvar.
- **Séries**: o que vale é o da **temporada**, dentro de `season_states` (`setSeasonState` aplica a
  mesma regra em JS; `touchSeasonAccess` é o "de novo" da temporada, `POST /:id/seasons/:n/access`).
  A coluna da série só é gravada pelo fallback de série sem `season_list`.
- **YouTube é a exceção**: não é dirigido por status (o `whenStatus` dele é `liked`, o default) e não
  tem botão — quem grava é `touchAccess` via `POST /api/youtube-library/:id/access`, chamado ao
  **abrir o drawer** do vídeo (e sem tocar `updated_at`: abrir é passivo e não pode reordenar a
  biblioteca). Por isso a coluna é `readonly` na config do model. O drawer só **grava**, não exibe:
  quem mostra a data é o chip do card (botão "Último acesso").
- Coluna nova em biblioteca precisa entrar também nas listas de `backupController`, senão se perde
  no round-trip de export/import.

`series_library` tem ainda `season_list` (JSONB, metadado das temporadas do TMDB), `season_states`
(JSONB, estado por temporada `{ "1": {status,score,isRewatching,notes,lastAccessAt} }`; `score` da série = média das notas)
e `cover_season` (INTEGER, temporada usada como capa da coleção). `game_library` tem `game_modes`
(`TEXT[]`). `books_library` tem `series_name` e `series_position` (`NUMERIC(6,2)` — a posição na
série da Hardcover é float8 com meio-valor real; ordena a expansão). As duas são **`readonly` no
model**: só `bulkUpsertBooks` (descoberta de série) as escreve, porque a série em destaque de um
livro pode ser outra que não a coleção em que ele está — drawer e job de refresh gravando-as
embaralhariam a ordem. `youtube_library` tem `tags` (`TEXT[] NOT NULL DEFAULT '{}'`, N tags por vídeo, `[]` = sem
tag; **só valem dentro de coleção** — ver a seção do YouTube acima) e sua coleção é a tabela à parte
`youtube_collection` (`id SERIAL`, `name`), referenciada por `collection_id ON DELETE SET NULL` e
podada quando fica vazia (`pruneEmptyCollections`). Colunas JSONB são
escritas com `JSON.stringify` explícito (ver `seriesLibraryModel`); `TEXT[]` vai como **array JS
direto** (ver `game_modes` e `tags`).

**Status vindos da API externa** (todos alimentados pelos jobs de refresh, nunca editáveis pelo
usuário): `anime_status` (AniList: `RELEASING`/`FINISHED`/`NOT_YET_RELEASED`) e, em filmes/séries/
jogos/livros, `movie_status`/`series_status`/`game_status`/`book_status`, que são só
`RELEASED`/`UPCOMING` derivados da
data. Séries têm além disso `air_status` — o status cru do TMDB (`Returning Series`/`Ended`/…),
que é o que dá os três estados do filtro de Exibição; `NULL` = nunca sincronizado, e é o que faz
o `findStaleSeries` puxar a linha para backfill. `synced_at` (todas as cinco tabelas) guarda o
último refresh; `NULL` entra na próxima execução do job. **`book_status` não usa o `deriveStatus` do
TMDB**: lá data nula significa "sem data marcada" e cai em `UPCOMING`, mas na Hardcover data nula é
"não se sabe" e o livro em geral é antigo — `deriveBookStatus` cai no ano e só então em `RELEASED`,
senão clássico sem data viraria "Em breve" e ficaria preso no TTL de 12 h para sempre.

**Status da biblioteca:** `plan_to_*` (planejo) → concluído (`watched`/`beaten`/`read`) →
`dropped`. Não existe status "em progresso" **nem reassistindo/rejogando**: a coluna
`is_rewatching` foi dropada e rever algo é só o `touchAccess` (a data de último acesso avança, o
status fica). YouTube usa `liked`/`removed`.

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
- **Hardcover** (livros, `https://api.hardcover.app/v1/graphql`, POST) — `authorization: Bearer` em
  **toda** consulta, inclusive a busca do catálogo: sem token o domínio inteiro cai (401). O token é
  **pessoal**, **expira em 1 ano e reseta em 1º de janeiro** (renovar em `hardcover.app/account/api`).
  Ids são **inteiros**. Tudo passa por `queryHardcover`, que normaliza erros em `HardcoverError`
  (401/403 têm mensagem própria, para o precipício anual ser diagnosticável). **Não manda header
  `x-ratelimit-*`**, então o `rateLimiter` aqui é só throttle de intervalo mínimo (350 ms; 60 req/min
  documentado). A busca é Typesense: `search(query_type:"Book")` devolve `results` como blob cru
  **não selecionável** (~4,8 KB por hit), e a ordenação padrão põe stub de poucos leitores no topo —
  por isso mantém-se a ordenação de relevância, pede-se 25 e filtra-se em código
  (`isQualityDocument`: `users_count >= 20`, tem capa, tem autor, não é compilação), com
  `hasNextPage` saindo da contagem **crua**. Gênero é tag de `tag_category_id: 1` (nome exato, ver
  `bookGenres.ts`); os gêneros do drawer saem de `cached_tags.Genre` (o join `taggings` repete tag).
  **Dedupe da série é obrigatório** (`distinct_on: position` + `canonical_id`/`is_partial_book`/
  `compilation`/`position not null`), senão traduções ocupam a mesma posição; e `series.books_count`
  conta linhas cruas, não membros deduplicados. Um livro pode estar em várias séries, então a coleção
  é a `cached_featured_series` — que a Hardcover às vezes marca errado (o "1984" aponta para uma série
  de thrillers da Lisa Scottoline), daí a **trava de sobreposição de autor** de 50% em
  `discoverBookSeries`.
- **TMDB** (filmes/séries), **IGDB** (jogos, via token Twitch em `igdbAuth`),
  **YouTube Data API** — chaves em env.
- **notify-api** (Telegram) — gateway compartilhado; o app só envia (texto/campos/botões).

## Variáveis de ambiente

Backend (`backend/.env`, copiar de `backend/.env.example`):
`DATABASE_URL`, `PORT` (3333), `TMDB_API_KEY`, `HARDCOVER_API_TOKEN`, `IGDB_CLIENT_ID`,
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
