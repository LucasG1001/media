# Modo offline

O app precisa abrir e mostrar a biblioteca inteira — dados **e** imagens — em dois cenários:

- **API externa fora** (TMDB/AniList/IGDB/Hardcover/YouTube caiu, ou o token da Hardcover expirou),
  com a VPS no ar.
- **Sem rede nenhuma**, quando o dispositivo não alcança a VPS (sem internet, VPN caída).

Offline é **somente leitura**. Não existe fila de sincronização de escrita: a UI desabilita as ações
que gravam em vez de acumulá-las.

## Três camadas

| Camada | O que garante | Onde vive |
|---|---|---|
| Cache de imagem no servidor | As capas existem em disco na VPS, não só na CDN de terceiros | `lib/imageStore.ts`, `/api/img`, job `warmupImages` |
| `detail_cache` no banco | O drawer abre inteiro (sinopse, elenco, screenshots) com a API externa fora | `models/detailCacheModel.ts`, `lib/detailWithCache.ts` |
| Service Worker | O app abre sem rede nenhuma, com o último estado das bibliotecas e as imagens | `vite.config.ts` (VitePWA) |

## 1. Cache de imagem

Cinco das seis mídias gravam no banco a **URL absoluta da CDN** (AniList, TMDB, Hardcover, YouTube);
jogos gravam o caminho de proxy `/api/game/image/...` desde uma migração antiga. Nada disso é tocado:
a coluna continua guardando a URL de origem, que é o que os jobs de refresh atualizam.

Quem desvia o tráfego é o **frontend**: `utils/imageUrl.ts` (`proxied`) transforma qualquer URL
absoluta em `/api/img?u=<encoded>`, e todo `<img>` de dado dinâmico passa por
`components/CoverImage`, que aplica o `proxied` e trata `onError`.

- **Chave** = `sha256(url)`. Arquivo em `<IMAGE_CACHE_DIR>/<hash[0:2]>/<hash>`, escrito em
  temporário e renomeado (o rename é atômico — leitor concorrente nunca abre arquivo pela metade).
- **Metadado** na tabela `image_cache` (`url_hash` PK, `url`, `content_type`, `bytes`, `fetched_at`,
  `last_hit_at`). Os bytes **não** vão para o Postgres. `content_type NULL` = a última tentativa
  falhou, e `fetched_at` é o relógio do backoff de 24 h.
- **Allowlist de host** em `lib/imageStore.ts`. `/api/img` recebe a URL do cliente: sem ela o backend
  seria um proxy aberto para qualquer endereço alcançável da VPS, inclusive a rede interna do
  compose. `IMAGE_EXTRA_HOSTS` (env, sufixos separados por vírgula) amplia sem deploy de código.
  URL com porta explícita e esquema que não seja http/https são recusados.
- **Dedupe de download concorrente** em `services/imageCacheService.ts`: abrir um grid pede a mesma
  capa dezenas de vezes em paralelo, e sem o mapa de promises em voo cada uma abriria um download.
- **404, nunca 502**, quando a imagem não está em cache e o download falha: o front cai no
  placeholder pelo `onError`, e um 5xx faria o Service Worker tratar como falha de rede.
- **IGDB** continua atendida por `/api/game/image/:size/:file` (o banco já guarda esse caminho), mas
  o handler agora delega ao mesmo store e ganhou cache em disco — antes cada miss de browser refazia
  o download na IGDB.

### Job `warmupImages`

Roda no fim do `runSyncTick` (boot + cada 30 min), `singleFlight`. Duas metades:

- **Download do que falta.** `findReferencedImageUrls()` junta `cover_image`/`poster_image`/
  `background_image`/`thumbnail`/`channel_thumbnail` das seis tabelas **mais os pôsteres dentro do
  JSONB `season_list`**; o caminho de proxy dos jogos volta a ser URL absoluta antes de baixar.
  Concorrência fixa de 6, teto de 300 por execução, `try/catch` por item — as regras do §10 de
  [sincronizacao.md](sincronizacao.md). URL que falhou não é retentada dentro de 24 h.
- **Prune.** Remove disco + linha do que não é referenciado **e** não tem `last_hit_at` há mais de
  90 dias. A janela importa: banner, screenshot, still de episódio e ícone de streaming são
  cacheados sob demanda e **nunca** aparecem em `findReferencedImageUrls` — sem ela o prune apagaria
  exatamente esses a cada volta.

Em produção o diretório é o volume `image_cache` montado em `/data/images` (o `Dockerfile` cria o
diretório com dono `node` antes do `USER node`, senão o container sobe sem permissão de escrita). Em
dev cai em `backend/.cache/images`, que está no `.gitignore`.

## 2. `detail_cache`

`detail_cache JSONB` + `detail_cached_at TIMESTAMPTZ` em `anime_library`, `movie_library`,
`series_library`, `game_library` e `books_library`. YouTube não tem: o `YoutubeDrawer` já renderiza
da entrada do banco. As duas colunas são **`readonly` no model** (mesmo padrão de `synced_at`).

- **Formato**: objeto com caminhos. O detalhe da mídia fica em `detail_cache->'detail'`; séries
  guardam também `detail_cache->'seasons'-><n>`, porque o `SeasonDrawer` precisa dos dois.
  `NULL` = nunca cacheado; `'{}'` = a última tentativa falhou.
- **Quem grava é o próprio `GET /api/<mídia>/:id`** (`lib/detailWithCache.ts`, `serveDetail`). O
  controller já tem o detalhe em mãos, e o `UPDATE ... WHERE <id externo> = $1` simplesmente não casa
  nada se o item não estiver na biblioteca. Nenhum componente do frontend mudou: abrir o drawer
  continua sendo o mecanismo de atualização.
- **Quem lê é o mesmo endpoint.** Se a API externa falha e há cache, responde **200 com o cache** e o
  header `X-From-Cache: 1`. É isto que faz todos os drawers voltarem a funcionar inteiros no cenário
  "API externa caiu", sem tocar em drawer nenhum. Sem cache, o erro sobe como antes.
- **Backfill** (`services/detailCacheBackfillService.ts`): job próprio no `runSyncTick`, teto de 50
  por mídia (**10 em anime** — o limiter da AniList é global ao processo e um lote grande atrasaria a
  busca do catálogo). Fica **fora** dos `findStale*` de propósito: coluna nova num `findStale*`
  tornaria a biblioteca inteira stale de uma vez. A condição tem saída garantida — falha carimba
  `detail_cached_at` e a linha só volta depois de 7 dias.
  **Operacional:** uma indisponibilidade longa marca a mídia inteira como `'{}'`, e aí o backfill só
  volta a tentar dela a uma semana. Foi o que aconteceu com livros quando o token anual da Hardcover
  expirou. Depois de consertar a causa, para não esperar:
  `UPDATE books_library SET detail_cache = NULL, detail_cached_at = NULL WHERE detail_cache = '{}'::jsonb;`
- **Fora do backup JSON**, deliberadamente. É a única exceção à regra "coluna nova de biblioteca
  entra no `backupController`". Medido nesta biblioteca, um `detail_cache` custa ~4 KB por anime,
  ~2 KB por jogo, ~1,7 KB por série e ~1 KB por filme — com tudo cacheado, ~4 MB só de cache num
  export que hoje é de algumas centenas de KB, e perto do `limit: "10mb"` do `express.json` que o
  import atravessa. Como é re-derivável (o `GET /:id` e o backfill reconstroem), não vale o preço.
  Ver `BACKUP-NOTES.md`.

## 3. Service Worker

`vite-plugin-pwa` (Workbox) em `generateSW`, `registerType: 'autoUpdate'`, registrado em `main.tsx`.
O manifest continua sendo mantido à mão em `public/manifest.webmanifest` (`manifest: false` no
plugin). Em dev o plugin não registra nada — `npm run dev` segue igual.

| Padrão | Estratégia | Por quê |
|---|---|---|
| `/api/img?…`, `/api/game/image/…` | CacheFirst, 1000 entradas / 90 dias | imagem servida pelo backend é imutável |
| `GET /api/*library` (+ `/collections`) | NetworkFirst, `networkTimeoutSeconds: 5` | com rede, dado fresco; sem rede, o último estado |
| `GET /api/{anime,movie,series,game,book}/<id>` (+ `/season/<n>`) | StaleWhileRevalidate | cobre o backend também estar fora |
| Catálogo, `/api/health` e todo POST/PUT/DELETE | NetworkOnly (default) | não faz sentido offline |

O `runtimeCaching` do `generateSW` casa **só GET** por padrão, então as rotas de mutação que
compartilham caminho com as de leitura ficam de fora sem regra extra.

**As regras dependem de as chamadas serem same-origin.** Uma `urlPattern` de RegExp que começa em
`\/api\/` não casa URL de outra origem, e o Workbox então nem cria rota — o cache simplesmente não
acontece, **sem erro nenhum**. Por isso a `baseURL` default do `services/api.ts` é `"/"` e não uma URL
absoluta: um build sem `VITE_API_URL` mandaria tudo para `http://localhost:3333` e o modo offline
ficaria silenciosamente morto. O compose já passa `VITE_API_URL: "/"`; o default cobre `npm run build`
local e qualquer deploy que esqueça a variável.

Para testar o Service Worker localmente é preciso `npm run build && npm run preview` (em dev o plugin
não registra nada) com o backend no ar — o bloco `preview.proxy` do `vite.config.ts` existe só para
isso. Duas armadilhas ao testar em aba não-focada: `loading="lazy"` não dispara sem a aba sendo
pintada, e o Service Worker só assume o controle a partir da **segunda** carga.

O `Caddyfile` do container `web` marca `sw.js`, `index.html` e `manifest.webmanifest` como
`Cache-Control: no-cache` — servidos de cache HTTP, um deploy novo demoraria a chegar no navegador.

## 4. UX offline

- **`services/api.ts`** ganhou interceptor de resposta: uma resposta (mesmo 500) prova alcance, e só
  a **ausência** de resposta conta como offline. É essa distinção que separa "API externa caiu" de
  "sem rede". `apiFailure`/`failureMessage` normalizam o erro, e o `libraryStore` usa a mensagem certa
  em vez dos `catch {}` que descartavam tudo.
- **`context/connectivityContext.ts`** (`useOnline`) + **`ConnectivityProvider`**: combina
  `navigator.onLine`, os eventos `online`/`offline` e uma sonda em `/api/health` com backoff
  exponencial (3 s → 60 s). A sonda existe porque offline o app não dispara requisição nenhuma —
  sem ela o banner só sairia da tela na próxima ação do usuário. E `/api/health` existe porque
  `navigator.onLine` dá falso-positivo com Wi-Fi no ar e VPN caída.
- **`OfflineBanner`** no `App.tsx`, faixa sticky com os tokens de aviso.
- **`hooks/useOfflineTab`**: offline a aba **efetiva** vira `library` e as de catálogo ficam
  desabilitadas no `TabNav`. A escolha do usuário fica guardada, então quando a rede volta ele cai de
  volta na aba em que estava — é estado derivado, não efeito. O `MediaGrid` mostra um estado próprio
  de "Sem conexão" quando está vazio e offline.
- **Escrita desabilitada** (`disabled` + `title` explicativo): `LibraryModalBase` (Salvar, Remover,
  "de novo", capa), `SelectionBar` (todas as ações em lote e o select mobile), o add-by-URL do
  `YouTubePage` e os três botões de backup do `SettingsPage`.
- **`components/DrawerFallback`**: corpo mínimo quando não há nem detalhe da API nem `detail_cache` —
  capa, título, aviso e **`NotesBlock`**. Antes esse caso mostrava só `"Erro ao carregar detalhes."`
  num painel vazio, e a anotação (o único dado do drawer que é do usuário) desaparecia junto. Os seis
  drawers recebem `fallback?: DrawerFallbackData`; as páginas montam a partir do `drawerEntry` que já
  tinham em mãos. O `SeriesDrawer` é o único sem `NotesBlock` no fallback — a anotação de série vive
  na temporada.

## O que funciona em cada cenário

| | API externa fora | Sem rede (SW ativo) |
|---|---|---|
| Bibliotecas (lista, coleções, filtros, ordenação) | ✅ | ✅ do cache |
| Capas e pôsteres | ✅ do disco da VPS | ✅ do cache do browser |
| Drawer completo | ✅ do `detail_cache` | ✅ se já aberto antes ou já backfillado |
| Drawer sem cache | corpo mínimo + anotação | corpo mínimo + anotação |
| Dashboard (agenda, carrosséis, contadores) | ✅ | ✅ |
| Catálogo / busca | aviso de indisponível | abas desabilitadas |
| Salvar status, nota, anotação, tag, capa | ✅ | desabilitado |
| Adicionar item novo | ❌ (a descoberta de coleção é externa) | desabilitado |
| Backup export/import | ✅ | desabilitado |

## Limitações conhecidas

1. O prune não varre **arquivos órfãos** no disco (arquivo sem linha em `image_cache`). Só acontece
   se o banco for restaurado sem o volume; nesse caso o diretório pode ser apagado à mão.
2. O warm-up faz um `stat` por URL referenciada a cada execução (alguns milhares de chamadas de
   sistema por tick). É barato, mas é O(biblioteca) mesmo quando não há nada para baixar.
3. O `detail_cache` de um item **nunca aberto e ainda não backfillado** não existe: offline ele cai no
   `DrawerFallback`. Em anime o backfill drena devagar de propósito (10 por tick), então uma
   biblioteca de ~570 animes leva cerca de um dia para ficar inteira.
4. Escrita offline não é enfileirada. É decisão de escopo, não limitação técnica.
5. O SW guarda a **última** resposta de cada biblioteca. Se você nunca abriu uma página de mídia com
   rede, ela não tem o que mostrar offline.
