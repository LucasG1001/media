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
**backup** export/import. O app é **offline-first para leitura**: capas ficam em disco na VPS,
o detalhe de cada item é cacheado no banco e um Service Worker deixa o app abrir sem rede — ver
`docs/offline.md`.

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
Browser → Vite dev proxy (ou Caddy do container web em prod)
        → Express (server :3333, /api)
        → PostgreSQL
        → APIs externas: AniList / TMDB / IGDB / Hardcover / YouTube
        → Cache de imagem em disco (volume image_cache, servido por /api/img)
        → notify-api :3334 → Telegram (só notificações)
```

### Backend (`backend/src/`)

Padrão em camadas por domínio: `types/` → `models/` (pg puro, mapper snake→camel) → `schemas/`
(Zod) → `controllers/` (`asyncHandler` + Zod, erros `{ error: "msg PT" }`) → `routes/`.

- **`server.ts`** — Express, registra as rotas de cada mídia (`/api/anime`, `/api/library`,
  `/api/movie`, `/api/movie-library`, `/api/series`, `/api/game`, `/api/book`,
  `/api/youtube-library`, `/api/backup`, `/api/img`, `/api/health`, …), roda `migrate()` e agenda os
  jobs (abaixo).
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
  - **`imageStore.ts`** (cache de imagem em disco: hash, allowlist de host, escrita atômica) e
    **`detailWithCache.ts`** (`serveDetail` — responde a API externa e guarda; com ela fora,
    responde o `detail_cache`). Ver `docs/offline.md`.
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
  - **`notifyService.ts`** — envia ao Telegram via notify-api; nunca lança. O relatório de erro
    inclui status HTTP e corpo da resposta quando o erro carrega um `AxiosError` em `cause` — por
    isso serviço que normaliza erro (`AniListError`, `HardcoverError`) **precisa repassar
    `{ cause }`**, senão o motivo real da API externa se perde e sobra só a mensagem PT genérica.
  - **`imageCacheService.ts`** / **`imageWarmupService.ts`** — baixam e servem as capas do disco
    (dedupe de download concorrente, warm-up e prune) e **`detailCacheBackfillService.ts`** —
    preenche o `detail_cache` de quem ainda não tem. Ver `docs/offline.md`.
- **Jobs (agendados em `server.ts`):** refresh de anime, séries, filmes, jogos e livros **no boot e a
  cada 30 min** (`runSyncTick`; rodar na subida evita deixar tudo parado meia hora após um restart —
  todos são `singleFlight`, então execução longa não se sobrepõe ao tick seguinte);
  **backfill de `detail_cache`** e **warm-up/prune do cache de imagem** no mesmo tick;
  **collection sync** diário (04:00); **notificação de lançamentos** diária (09:00). No boot roda
  também `backfillGameModes` (one-shot): preenche `game_modes` dos jogos com a coluna NULL via
  `fetchGameModes` (IGDB) — idempotente (`NULL` = nunca buscado; `[]` = sem modo conhecido). E
  `backfillSeriesSeasons` (one-shot): preenche `season_list` das séries com a coluna NULL via
  `fetchSeriesById` (TMDB). O refresh de séries também atualiza `season_list` (pega novas
  temporadas), sem tocar em `season_scores`. E `backfillReleaseDates` (one-shot): preenche as datas
  de "terminou de lançar" nas linhas antigas — `end_date` (anime, lote na AniList) e
  `last_aired_episode` (séries, 1 requisição por série). Nenhuma das duas entra em `findStale*`: a
  condição do anime não tem saída garantida (a AniList devolve `endDate` incompleta para alguns
  títulos) e lá a linha ficaria stale para sempre.
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
- **Padrão de página de mídia**: catálogo (`useMediaList`) + biblioteca (`use*Library`); a
  biblioteca é um `FranchiseGrid` sobre grupos de coleção montados num `useMemo`
  (`build*CollectionGroups` com `memberFilter` → `filterGroupsBySearch` → `sortGroups`), com
  `LibraryControls` no topo e um drawer por item.
- **`hooks/useMediaList.ts`** — estado de catálogo com paginação, cache por chave, `AbortController`
  (cancela busca anterior) e `reset()`. Um `useLibrary`-like por mídia para o CRUD com estado local
  otimista; `store.mutate` = primitivo de update otimista com endpoint custom.
- **Componentes compartilhados**: `MediaCard`/`MediaGrid` (catálogo), `FranchiseGrid` (biblioteca
  agrupada por franquia/coleção), `LibraryModalBase` (modal de status/nota), `LibraryControls`
  (busca + Filtros + Ordenação), `NotesBlock` (anotação livre). Config visual por mídia em
  **`config/cards.tsx`**. Props, slots de inversão de controle (`renderExpansion`, `extraActions`) e
  comportamento dos painéis: **ver `docs/frontend-componentes.md`** antes de mexer neles.
- **Biblioteca = coleções (invariantes que valem para todas as mídias)**: agrupamento, filtro
  member-level que reduz a coleção sem mudar o total do badge, ordenação por grupo (data = mais
  antigo, nota = média) e "capa é só coleção". **Ver `docs/frontend-colecoes.md`** antes de mexer em
  filtro/ordenação/agrupamento de biblioteca.
- **Séries = coleção de temporadas**: a coleção não vem de linhas do banco — é sintetizada de
  `season_list`/`season_states`, e a nota da série é sempre a média das temporadas. **Ver
  `docs/frontend-series-temporadas.md`** antes de mexer em séries/temporadas.
- **YouTube = coleção + tag escopada à coleção** (tag só existe dentro de coleção; o filtro de tag
  vive dentro da expansão). **Ver `docs/frontend-youtube-tags.md`** antes de mexer na página do
  YouTube ou em tags.
- **Drawers, trailer e anotações**: navegação de coleção (`DrawerNav` + `utils/collectionNav.ts`),
  teclado (`hooks/useDrawerKeys.ts`), tela cheia própria do `TrailerEmbed` e a regra de que
  **nenhum drawer leva `key` por item**. **Ver `docs/frontend-drawers.md`** antes de mexer em drawer,
  player ou bloco de anotação.
- **Dashboard**: agrega no cliente sobre as bibliotecas já carregadas, em carrosséis de agenda e de
  lançamentos recentes. **Ver `docs/frontend-dashboard.md`** antes de mexer nele.
- **Offline**: toda imagem de dado dinâmico passa por `components/CoverImage` (que aplica
  `utils/imageUrl.ts` e trata `onError`) — **nunca use `<img>` cru para URL de terceiro**. O estado de
  rede sai de `useOnline` (`context/connectivityContext.ts`) e governa aba inicial, botões de escrita
  e o `DrawerFallback`. **Ver `docs/offline.md`** antes de mexer em imagem, cache ou Service Worker.
- **`utils/`** — `buildFranchiseGroups`/`build*CollectionGroups` (agrupam + `memberFilter`),
  `sortGroups.ts` (ordenações por coleção) e `filterGroupsBySearch` montam a lista da biblioteca;
  envolver o pipeline em `useMemo`.
- `hooks/useDismiss.ts` centraliza Escape + scroll-lock (mobile) dos painéis.

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
tag; **só valem dentro de coleção** — ver `docs/frontend-youtube-tags.md`) e sua coleção é a tabela à parte
`youtube_collection` (`id SERIAL`, `name`), referenciada por `collection_id ON DELETE SET NULL` e
podada quando fica vazia (`pruneEmptyCollections`). Colunas JSONB são
escritas com `JSON.stringify` explícito (ver `seriesLibraryModel`); `TEXT[]` vai como **array JS
direto** (ver `game_modes` e `tags`).

**`detail_cache`** (`JSONB`) + **`detail_cached_at`** — última resposta de detalhe da API externa,
para o drawer abrir inteiro com ela fora. Existe nas cinco mídias com catálogo (não em
`youtube_library`, cujo drawer já vem do banco) e é **`readonly` no model**. `NULL` = nunca
cacheado; `'{}'` = última tentativa falhou. **Única coluna de biblioteca deliberadamente fora do
`backupController`** — é cache re-derivável. Fora das tabelas de mídia existe **`image_cache`**
(metadado do cache de capas; os bytes ficam em disco, no volume `image_cache`). As duas coisas estão
detalhadas em `docs/offline.md`.

**Status vindos da API externa** (todos alimentados pelos jobs de refresh, nunca editáveis pelo
usuário): `anime_status` (AniList: `RELEASING`/`FINISHED`/`NOT_YET_RELEASED`) e, em filmes/séries/
jogos/livros, `movie_status`/`series_status`/`game_status`/`book_status`, que são só
`RELEASED`/`UPCOMING` derivados da
data. Séries têm além disso `air_status` — o status cru do TMDB (`Returning Series`/`Ended`/…),
que é o que dá os três estados do filtro de Exibição; `NULL` = nunca sincronizado, e é o que faz
o `findStaleSeries` puxar a linha para backfill. **Quando algo terminou de lançar** é outra coisa:
o status externo é recalculado a cada sync comparando a data com hoje, então o instante da virada
não fica registrado. Quem guarda a data são `anime_library.end_date` (`endDate` da AniList, ISO;
`NULL` = desconhecida ou incompleta) e `series_library.last_aired_episode` (JSONB
`{season, episode, airDate}`, do `last_episode_to_air` do TMDB). As duas vêm de campos que as APIs
já devolvem nas requisições que os jobs fazem, então custam zero requisição.
**Qual foi o último episódio exibido** é uma terceira coisa: `anime_library.last_aired_episode`
(JSONB `{episode, airingAt}`) — o `nextAiringEpisode` diz o que vem, não o que passou, e a data do
anterior não é dedutível (nem toda exibição é semanal). Vem do `Page.airingSchedules`
(`fetchLastAiredEpisodes`, consulta separada, em lote, ordenada por tempo desc — a primeira
ocorrência de cada `mediaId` é o episódio mais recente dele) e é gravada **só para anime
`RELEASING`**, que o refresh revisita de hora em hora. Tem backfill de boot mesmo assim: a linha só
entra no refresh depois de ficar stale, então sem ele o carrossel de episódios nasce vazio.
`synced_at` (todas as cinco tabelas) guarda o
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
- **Estilo**: CSS Modules por componente. Sempre usar os tokens de
  `styles/global.css` (tema dark), **nunca** hardcode de cores/tamanhos.
- **Estado**: só hooks do React (`useState`/`useContext`/`useReducer`) — sem Redux/Zustand.
- **Sem comentários no código**, exceto quando registram uma restrição não óbvia.
- **HTTP**: `201` create, `204` delete, `400` validação, `404` not found, `409` conflito
  (`anilist_id`/id externo duplicado), `500` erro.

## Integrações externas

- **AniList** (`https://graphql.anilist.co`, POST, sem auth) — limite documentado 90 req/min, mas
  na prática degradado (~30/min). Todo tráfego passa por `queryAniList`, que aplica o
  `rateLimiter` (throttle ~2s + pacing por header) e normaliza erros em `AniListError` (a AniList
  responde HTTP 200 com `{ errors, data:null }` em erro de validação; 404 vira 404; 403 — como eles
  desligam a API inteira — vira 503). Estações: meses 1–3 WINTER, 4–6 SPRING, 7–9 SUMMER,
  10–12 FALL. `MEDIA_FIELDS` é compartilhado com as
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
`IGDB_CLIENT_SECRET`, `YOUTUBE_API_KEY`, `NOTIFY_API_URL`, `NOTIFY_API_KEY`,
`IMAGE_CACHE_DIR` (onde as capas ficam em disco) e `IMAGE_EXTRA_HOSTS` (sufixos de host extras
aceitos por `/api/img`).

Docker (`.env` na raiz, copiar de `.env.example`): `POSTGRES_USER/PASSWORD/DB`, `MEDIA_DOMAIN`,
as chaves das APIs externas e `NOTIFY_API_KEY`.

## Produção (Docker) e proxy

Stack `media-tracker` (`docker-compose.yml`): `postgres` (banco dedicado, volume), `server`
(Express/API, com o volume `image_cache` em `/data/images` — o cache de capas; sem ele o app perde as
imagens offline a cada recriação do container) e `web` (Caddy: serve o build do frontend, marca
`sw.js`/`index.html` como `no-cache` e faz proxy de `/api` → `server:3333`). O
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

Este arquivo é carregado em **toda** sessão, mesmo em tarefas que não tocam a área descrita. Fica
aqui só o que qualquer tarefa se beneficia de saber de cara: visão geral, comandos, arquitetura em
nível de camada, invariantes que atravessam múltiplas mídias/áreas, convenções, integrações
externas, env vars, produção e fluxo de trabalho. O detalhe de cada área vive em `docs/`, apontado
por uma linha daqui.

- **Teste antes de escrever**: "isso muda como alguém aborda QUALQUER tarefa no projeto, ou só uma
  área específica?" Se for só uma área específica, vai para um doc em `docs/`, **não** para o
  CLAUDE.md — com uma linha de referência aqui.
- **Não documente aqui** comportamento de UI, algoritmo de um componente ou decisão de estilo/CSS
  isolada de um único componente. Isso vai para `docs/`.
- **Nunca adicione uma seção nova** ao CLAUDE.md sem antes verificar se ela não deveria, na
  verdade, ser um novo arquivo em `docs/`.
- **Antes de fechar qualquer tarefa** que tenha adicionado ou editado uma seção daqui, revise se o
  trecho ainda é do tamanho mínimo necessário e se não caberia melhor em um doc separado.
- Quando uma mudança tornar algo aqui factualmente incorreto (módulo/arquivo renomeado ou
  removido, comando alterado, nova integração, novo invariante ou gotcha), atualize a linha
  afetada na mesma tarefa — **e o mesmo vale para o doc em `docs/` da área tocada**.
- Edite no lugar e remova o que ficou obsoleto — este arquivo não cresce sem contrapartida.
  Prefira descrever padrões/invariantes estáveis a listar arquivos.
- Documente fatos, não preferências. Não adicione convenções ou "boas práticas" novas por conta
  própria: proponha e deixe a decisão de estilo comigo.
- Mantenha conciso e em português.
