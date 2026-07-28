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
  - **`releaseNotifyService.ts`** — avisa lançamentos de filmes/jogos.
  - **`notifyService.ts`** — envia ao Telegram via notify-api; nunca lança.
- **Jobs (agendados em `server.ts`):** `refreshStaleEntries`+séries a cada 30 min; **collection
  sync** diário (04:00); **notificação de lançamentos** diária (09:00). No boot roda também
  `backfillGameModes` (one-shot): preenche `game_modes` dos jogos com a coluna NULL via
  `fetchGameModes` (IGDB) — idempotente (`NULL` = nunca buscado; `[]` = sem modo conhecido). E
  `backfillSeriesSeasons` (one-shot): preenche `season_list` das séries com a coluna NULL via
  `fetchSeriesById` (TMDB). O refresh de séries (30 min) também atualiza `season_list` (pega novas
  temporadas), sem tocar em `season_scores`.

### Frontend (`frontend/src/`)

- **`App.tsx`** — BrowserRouter + Sidebar; páginas `Dashboard`, `Anime`, `Movies`, `Series`,
  `Games`, `Books`, `YouTube`, `Settings`.
- **Componentes compartilhados**: `MediaCard`/`MediaGrid` (catálogo), `FranchiseGrid` (biblioteca
  agrupada por franquia/coleção), `LibraryModalBase` (seletor de status derivado do mapa de labels
  de cada mídia), `LibraryControls` (barra de biblioteca: busca + botões Filtros/Ordenação com painel
  que é bottom-sheet no mobile e popover ancorado no desktop + chip de contagem; dirigido por config
  `filterGroups`/`sort`, cada página monta a config do seu estado). Config visual por mídia em
  **`config/cards.tsx`**.
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
  - **Ordenação (de seleção única, `hooks/useSingleSort.ts`; sempre uma ativa)** opera sobre o grupo
    **já reduzido**, via `utils/sortGroups.ts`: **data** = item **mais antigo** da coleção
    (`sortGroupsByMemberDate`, `agg:"oldest"`); **nota** = **média** das notas dos membros com
    `score>0` (`sortGroupsByAvgScore`); **YouTube: visualizações** = **soma** (`sortGroupsBySumViews`),
    **alfabética** (`sortGroupsByName`, padrão) e **data**. Exceção: Livros "Leitura" usa a data de
    leitura **mais recente** (`agg:"latest"`). Avulsos contam como coleção de 1.
  - Padrões: anime/filmes/jogos = Lançamento(desc)+Nota; séries idem; livros =
    Publicação(desc)+Leitura+Nota; YouTube = Alfabética(asc)+Data+Visualizações.
  - **Capa é só coleção (anime/filmes/séries/jogos; prop `coverIsCollectionOnly` do
    `FranchiseGrid`/`FranchiseCard`, que livros e YouTube NÃO passam)**: em grupo com 2+ itens a capa
    exibe apenas a **média** — sem botão de status (`MediaCard` prop `hideAddButton`) — e o clique
    **expande/recolhe** em vez de abrir o drawer do representante (que segue acessível como membro da
    expansão, já que `buildCollectionGroups` inclui o representante em `members`). **Grupo de 1 item
    é card simples normal**: botão de status (status/nota/remover) + drawer no clique. Como `count` é
    o total **não filtrado**, um grupo de 2+ reduzido a 1 pelo filtro continua sendo coleção.
  - **Séries = coleção de temporadas** (`utils/seasonGroups.ts`, `buildSeasonGroups`): a coleção
    NÃO vem de linhas do banco — cada série é **1 linha** e os membros (temporadas) são sintetizados
    do JSONB `season_list` (metadado) + `season_states` (estado do usuário por temporada:
    `{status,score,isRewatching}`). **Cada temporada se comporta como um filme da coleção**: card com
    botão de status colorido + nota própria. Representante = a série (nome + capa: pôster da temporada
    `cover_season`, senão da série), sujeito à regra `coverIsCollectionOnly` acima. Nos
    membros: clique na **imagem** → `SeasonDrawer`, que traz **os dados da série** (banner, trailer,
    gêneros, onde assistir, grade de 5 infos — corpo compartilhado `SeriesDrawer/SeriesDetailBody.tsx`,
    com overrides de pôster/tagline/sinopse da temporada) **+ a lista de episódios** (`GET
    /api/series/:id/season/:n`); clique no **botão de status** →
    `SeasonLibraryModal` (`LibraryModalBase`, status/nota/reassistindo + "Definir como capa"; `onSetCover`
    e `onRemove` são opcionais — temporada de coleção não se remove sozinha) → `saveSeason`
    (`PUT /:id/seasons/:n`, `setSeasonState` recalcula `score` da série =
    média das notas > 0) e `setCoverSeason` (`PUT /:id/cover-season/:n`). A coluna `score` de
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
- **`hooks/useMediaList.ts`** — estado de catálogo com paginação, cache por chave, `AbortController`
  (cancela busca anterior) e `reset()`. Um `useLibrary`-like por mídia para o CRUD com estado local
  otimista.
- **`utils/`** — `buildFranchiseGroups`/`build*CollectionGroups` (agrupam + `memberFilter`),
  `sortGroups.ts` (ordenações por coleção) e `filterGroupsBySearch` montam a lista da biblioteca;
  envolver o pipeline em `useMemo`. Ver invariantes de filtro/ordenação por coleção acima.

### Esquema do banco (uma tabela por mídia)

`anime_library`, `movie_library`, `series_library`, `game_library`, `books_library` (plural),
`youtube_library`. Colunas em `TEXT`/`JSONB`, sem CHECK de enum (migração de status = `UPDATE`).
Convenções comuns: `is_cover` (capa da coleção), `is_rewatching`, timestamp de conclusão
(`watched_at`/`finished_at`/`read_at`), coluna de coleção (`franchise_id`/`collection_id`).
`series_library` tem ainda `season_list` (JSONB, metadado das temporadas do TMDB), `season_states`
(JSONB, estado por temporada `{ "1": {status,score,isRewatching} }`; `score` da série = média das notas)
e `cover_season` (INTEGER, temporada usada como capa da coleção). `game_library` tem `game_modes`
(`TEXT[]`). Colunas JSONB são escritas com `JSON.stringify` explícito (ver `seriesLibraryModel`).

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
