# Sincronização de dados

Como os dados da biblioteca são mantidos atualizados em relação às APIs externas: o que roda,
quando roda, o que cada coisa grava e quanto tende a demorar.

O app é online-only e de usuário único. Nada aqui exige ação manual — tudo é agendado no
`backend/src/server.ts` e roda dentro do processo do Express (não há worker separado nem cron do
sistema operacional).

---

## 1. Visão geral

| Quando | O que roda | Mídias | Bate em API externa? |
|---|---|---|---|
| Boot + a cada 30 min | `runSyncTick` — refresh das entradas "stale" | Anime, Séries, Filmes, Jogos | Sim |
| Boot + a cada 30 min | `notifyDueSeriesEpisodes` | Séries | Não (só banco + Telegram) |
| Diário 04:00 | `refreshCollections` — sync de coleções | Anime, Filmes, Jogos | Sim |
| Boot + diário 09:00 | `notifyDueReleases` | Filmes, Jogos | Não (só banco + Telegram) |
| Boot (one-shot) | `backfillGameModes` | Jogos | Sim, só se houver linha pendente |
| Boot (one-shot) | `backfillSeriesSeasons` | Séries | Sim, só se houver linha pendente |
| Ao abrir o drawer | `handle*Load` na página | Todas | Sim (detalhe do item) |

Livros e YouTube **não têm sincronização de fundo**. Livro nunca muda depois de publicado, e o
YouTube tem fluxo próprio de importação.

Três caminhos escrevem dados vindos de API na biblioteca:

1. **Criação** — ao adicionar o item, os dados do card já vêm preenchidos.
2. **Drawer** — abrir o item na UI compara os campos e atualiza se algo mudou.
3. **Jobs** — o assunto deste documento.

O invariante é que **o job grava o mesmo conjunto de campos que o drawer grava**. O drawer é um
atalho, não a única forma de o dado sair do lugar. Antes isso não valia, e por isso título e capa
envelheciam indefinidamente em item que você nunca abria.

---

## 2. `runSyncTick` — boot e a cada 30 min

Dispara quatro jobs independentes, sem esperar um pelo outro. Todos são `singleFlight`: se uma
execução ainda estiver rodando quando o próximo tick chegar, a nova chamada devolve a mesma
promessa em vez de começar de novo. Uma execução lenta atrasa, nunca empilha.

Roda também na subida do processo — sem isso, um restart deixava toda a sincronização parada por
meia hora.

### 2.1 Anime — `refreshStaleEntries`

`services/librarySyncService.ts` · API: AniList (GraphQL)

**Quem entra:** `libraryModel.findStale(1, 168)`

```
synced_at IS NULL
OR season_year IS NULL
OR (anime_status != 'FINISHED'  AND synced_at < agora - 1h)
OR (anime_status  = 'FINISHED'  AND synced_at < agora - 7 dias)
```

TTL de **1 hora** para anime em exibição (é o que ganha episódio novo) e **7 dias** para
finalizado. Note que aqui, diferente das outras mídias, **anime abandonado também é
sincronizado** — ver §8.

**Como roda:** lotes de 50 ids, **um lote por consulta**, sequencial. Cada lote tem `try/catch`
próprio: falha transitória num lote não descarta o que os outros já trouxeram.

**O que grava:** `title`, `cover_image`, `format`, `total_episodes`, `anime_status`, `season_year`,
`next_airing_episode`, `streaming_links`, `synced_at`.

**O que notifica:** episódio novo (`notifyNewEpisode`) e anime finalizado (`notifyAnimeFinished`).
Só para linha que já tenha `synced_at` — no primeiro sync não há com o que comparar — e nunca para
abandonado.

### 2.2 Séries — `refreshStaleSeries`

`services/seriesLibrarySyncService.ts` · API: TMDB

Roda **depois** do `notifyDueSeriesEpisodes` (encadeado com `.then`), para que a notificação de
episódio use o estado anterior antes de ele ser sobrescrito.

**Quem entra:** `findStaleSeries(12, 168)`

```
status != 'dropped' AND (
  synced_at IS NULL
  OR air_status IS NULL
  OR (next_airing_episode IS NOT NULL AND synced_at < agora - 12h)
  OR (next_airing_episode IS NULL     AND synced_at < agora - 7 dias)
)
```

TTL de **12 horas** para série com episódio agendado e **7 dias** para as demais. O
`air_status IS NULL` é o backfill da coluna: cada série entra uma vez e sai.

**Como roda:** lotes de **10 em paralelo**, 1 requisição TMDB (`/tv/:id`) por série. O teto existe
porque o TMDB não tem endpoint em lote e há momentos em que a biblioteca inteira fica stale de uma
vez — foi exatamente o que o `air_status IS NULL` provocou quando foi adicionado.

**O que grava:** `title`, `poster_image`, `first_air_date`, `seasons`, `episodes`, `series_status`,
`air_status`, `next_airing_episode`, `season_list`, `synced_at`.

`season_list` é atualizado a cada refresh, então **temporada nova aparece sozinha**. O
`season_states` (seu status/nota por temporada) nunca é tocado.

**O que notifica:** episódio novo e série finalizada (`airStatus` em `Ended`/`Canceled` sem próximo
episódio).

### 2.3 Filmes — `refreshStaleMovies`

`services/releaseLibrarySyncService.ts` · API: TMDB

**Quem entra:** `findStaleMovies(12, 168, 100)`

```
status != 'dropped' AND (
  synced_at IS NULL
  OR (movie_status  = 'UPCOMING' AND synced_at < agora - 12h)
  OR (movie_status != 'UPCOMING' AND synced_at < agora - 7 dias)
)
ORDER BY synced_at ASC NULLS FIRST
LIMIT 100
```

Filme não tem episódio para acompanhar: o que envelhece é a **data de lançamento** (adiamento),
o título e a capa. Por isso o TTL curto vale só para quem ainda não lançou.

**Como roda:** lotes de **10 em paralelo**, 1 requisição TMDB por filme, com teto de **100 por
execução**. O teto espalha o primeiro backfill: uma biblioteca de 500 filmes leva ~2h30 (100 a cada
30 min) para completar a primeira volta. Depois disso o volume por execução cai para quase nada.

**O que grava:** `title`, `poster_image`, `release_date`, `runtime`, `movie_status`, `synced_at`.

**O que notifica:** nada. Aviso de lançamento é do job das 09:00 (§4).

### 2.4 Jogos — `refreshStaleGames`

`services/releaseLibrarySyncService.ts` · API: IGDB

**Quem entra:** `findStaleGames(12, 168)` — mesma lógica dos filmes, **sem teto por execução**.

**Como roda:** lotes de 200 ids, **um lote por consulta** (`where id = (...)`). A IGDB aceita
consulta em lote, então a biblioteca inteira cabe em poucas requisições e não precisa de
fatiamento por execução.

Jogo que não voltar na resposta (removido da IGDB) é pulado — a linha fica como está.

**O que grava:** `title`, `background_image`, `released`, `metacritic`, `game_status`, `synced_at`.

`game_modes` **não** entra aqui: é preenchido na criação, pelo controller. O backfill de boot
(§5) existe só para as linhas antigas.

### 2.5 `notifyDueSeriesEpisodes`

Não bate em API externa. Varre `series_library` por episódio cujo `airingAt` já passou e que ainda
não foi notificado (`next_airing_episode->>'episode' > last_notified_episode`), manda ao Telegram e
marca `last_notified_episode`.

Existe separado do refresh porque o episódio pode estrear entre dois refreshes: o TTL de 12 h é
grande demais para servir de relógio de notificação.

---

## 3. Sync de coleções — diário, 04:00

`services/collectionSyncService.ts` · APIs: AniList, TMDB, IGDB

Roda anime → filmes → jogos, **em sequência**. Não roda no boot.

**O que faz:** para cada coleção que tenha **ao menos um item concluído** (`watched`/`beaten`),
descobre os membros que faltam e adiciona como "planejo", notificando cada um. É assim que
sequência/OVA/filme novo de uma franquia que você terminou aparece sozinho na biblioteca.

**Como escolhe as sementes:** um item por coleção (`franchise_id`/`collection_id`) que tenha
concluído. Item concluído **sem** coleção também vira semente — é o que descobre a franquia de um
anime avulso pela primeira vez.

**Custo por semente:**

| Mídia | Descoberta | Requisições |
|---|---|---|
| Anime | `discoverFranchise` — BFS pelas relações (`SEQUEL`/`PREQUEL`/`PARENT`/`SIDE_STORY`), teto de 50 nós | 3–5 consultas encadeadas, cada uma segurada ~2 s pelo rate limiter |
| Filmes | `discoverCollection` — detalhe do filme + detalhe da coleção | 2 |
| Jogos | `discoverGameCollection` — referência + detalhe da coleção | 2 |

Quando encontra membro novo, o `bulkUpsert` manda **todos** os membros, não só os novos. Isso é
intencional e seguro: o `ON CONFLICT` só mexe em `franchise_id`/`format` (filmes/jogos:
`collection_id`) via `COALESCE`, então serve de backfill e nunca pisa no seu status ou nota.

> **Este é o job mais caro e o menos otimizado.** Não existe memória de "já verifiquei esta
> coleção": ele redescobre todas, todo dia, para na esmagadora maioria das vezes não achar nada.
> Ver §8.

---

## 4. Notificação de lançamentos — boot e diário, 09:00

`services/releaseNotifyService.ts`

Não bate em API externa — lê a data que já está no banco (mantida fresca pelos jobs de §2.3 e
§2.4) e avisa o que lançou.

Varre `movie_library` e `game_library` com `release_notified_at IS NULL AND status != 'dropped'`:

- Data no futuro ou ausente → deixa para reavaliar nos próximos dias.
- Lançou nos últimos **3 dias** → notifica e marca `release_notified_at`.
- Lançou há mais de 3 dias (backlog antigo) → marca em silêncio, sem notificar.

A janela de 3 dias evita que a primeira execução após adicionar um catálogo antigo dispare uma
avalanche de notificações.

---

## 5. Backfills de boot (one-shot)

Rodam uma vez a cada subida do processo e são idempotentes — se não há linha pendente, saem sem
fazer requisição nenhuma.

| Job | Alvo | Como |
|---|---|---|
| `backfillGameModes` | `game_modes IS NULL` | Lotes de 200 na IGDB. `NULL` = nunca buscado; `[]` = jogo sem modo conhecido. A distinção é o que impede o reprocessamento eterno. |
| `backfillSeriesSeasons` | `season_list IS NULL` | Uma chamada de detalhe TMDB por série, **sequencial**. |

Backfill de coluna nova nem sempre precisa virar job: quando dá, é melhor pendurar a condição no
`findStale*` da mídia (foi o que o `air_status IS NULL` fez) e deixar o job de 30 min resolver.

---

## 6. Quem escreve o quê

Colunas alimentadas por API externa. As demais (`status`, `score`, `is_cover`, `is_rewatching`,
`season_states`, `cover_season`, timestamps de conclusão) são **suas** e nenhum job encosta nelas.

| Coluna | Criação | Drawer | Job 30 min | Sync coleções |
|---|:---:|:---:|:---:|:---:|
| `title`, capa | ✅ | ✅ | ✅ | só em item novo |
| `anime_status` / `movie_status` / `series_status` / `game_status` | ✅ | ✅ | ✅ | só em item novo |
| `air_status` (séries) | — | — | ✅ | — |
| `total_episodes` / `episodes` / `seasons` / `runtime` / `metacritic` | ✅ | ✅ | ✅ | só em item novo |
| data de lançamento/estreia | ✅ | ✅ | ✅ | só em item novo |
| `next_airing_episode` | — | — | ✅ | — |
| `streaming_links`, `season_year`, `format` (anime) | ✅ | — | ✅ | ✅ (`COALESCE`) |
| `season_list` (séries) | ✅ | — | ✅ | — |
| `game_modes` | ✅ | — | — | ✅ |
| `franchise_id` / `collection_id` | ✅ | — | — | ✅ (`COALESCE`) |
| `synced_at` | — | — | ✅ | — |
| `last_notified_episode` | — | — | ✅ | — |
| `release_notified_at` | — | — | — | job das 09:00 |

**Proteção de título e capa:** os `UPDATE` de sync usam `COALESCE(NULLIF($x, ''), coluna)`. Uma
resposta com o campo vazio — o TMDB em `pt-BR` devolve `poster_path` nulo de vez em quando — não
apaga um valor bom. Sem isso, um job silencioso a cada 30 min estragaria a biblioteca em escala.

---

## 7. Infraestrutura compartilhada

### Cache de resposta (`lib/cache.ts`)

`Map` em memória, TTL de **1 hora**, chave = método + URL + params + body. Some no restart.

Serve o catálogo, mas os jobs também passam por ele — ver §8.

### Retry (`lib/httpClient.ts`)

Timeout de 10 s, até **2 retentativas** em 429 e 5xx (e em erro sem resposta). Backoff de
300 ms × 2^tentativa, ou o `Retry-After` do cabeçalho quando existe. Erro 4xx que não seja 429 não
é retentado.

### Rate limiter (`lib/rateLimiter.ts`) — só AniList

A AniList documenta 90 req/min mas na prática degrada para ~30. Todo tráfego passa por
`queryAniList`, que aplica:

- intervalo mínimo de **2 s** entre consultas, serializadas numa fila;
- pausa proativa quando `X-RateLimit-Remaining` fica ≤ 5, até o `X-RateLimit-Reset`;
- cooldown ao receber 429.

O limiter é **global ao processo**: navegar no catálogo de anime durante o sync de coleções faz os
dois disputarem a mesma fila. TMDB, IGDB, Google Books e YouTube não têm limiter — só o retry.

### Erros

Todo job embrulha suas falhas em `notifyError`, que loga e manda ao Telegram pela notify-api, com
deduplicação de erro repetido. **Job nunca derruba o processo** e `notifyService` nunca lança.

---

## 8. Tempo estimado

> ⚠️ **São estimativas derivadas** da contagem de requisições e dos limites conhecidos, **não
> medições**. A parcela de rede (200–600 ms por requisição a TMDB/IGDB) varia com a VPS.

| Job | Fórmula | Exemplo |
|---|---|---|
| Anime (30 min) | `teto(N/50)` consultas × ~2 s | 200 anime stale → ~4 consultas → **~8 s** |
| Séries (30 min) | `teto(N/10)` rodadas × ~0,5 s | 100 séries stale → 10 rodadas → **~5 s** |
| Filmes (30 min) | `teto(N/10)` rodadas × ~0,5 s, N ≤ 100 | teto atingido → **~5 s** por execução |
| Jogos (30 min) | `teto(N/200)` consultas | 500 jogos stale → 3 consultas → **~2 s** |
| Coleções (04:00) | anime domina: 6–10 s por semente | 20 franquias + 15 coleções → **~3 a 4 min** |
| Lançamentos (09:00) | só banco | **< 1 s** |

Em regime normal os jobs de 30 min terminam em poucos segundos, porque quase nada está stale —
o volume real aparece na primeira execução após um deploy que mexa nas condições de staleness.

O pico previsível é o **primeiro tick depois de adicionar coluna a um `findStale*`**: a biblioteca
inteira fica stale de uma vez. Filmes têm teto de 100 por execução; séries e anime absorvem pelo
fatiamento; jogos resolvem em poucas consultas em lote.

---

## 9. Limitações conhecidas

Levantadas em revisão e **ainda não corrigidas**. Em ordem de impacto:

1. **O sync das 04:00 não tem memória.** Redescobre todas as coleções todo dia, sem
   `checked_at` nem TTL, para quase sempre não achar nada. É o maior desperdício da
   sincronização; o custo cai ~90% com uma coluna de última verificação e TTL maior para franquia
   cujos membros já lançaram.

2. **`season_year IS NULL` prende anime no estado stale para sempre.** A condição está em
   `findStale`, mas a AniList devolve `seasonYear` nulo legitimamente para vários OVAs, filmes e
   anime sem data. Esses registros são rebuscados a cada 30 min, indefinidamente, e o `UPDATE`
   grava `NULL` de novo. É a mesma armadilha do `air_status IS NULL`, só que sem saída — o
   `air_status` se resolve porque o TMDB sempre devolve um status.

3. **Os jobs leem pelo cache de 1 h da interface.** Conceitualmente errado: um refresh de fundo
   existe para buscar dado fresco e pode acabar gravando resposta de até 1 h atrás carimbando
   `synced_at = NOW()`. Hoje quase não morde — séries, filmes e jogos têm TTL de 12 h, bem acima
   do cache. O apertado é **anime**, cujo TTL de 1 h coincide com o do cache. Falta um
   `skipCache` no caminho dos jobs.

4. **O cache nunca despeja nada.** Entrada expirada só sai se alguém pedir aquela chave de novo
   (`cacheGet`). Quem alimenta o crescimento é a busca do catálogo: com debounce, digitar "naruto"
   grava `nar`, `naru`, `narut`, `naruto`, e três dessas nunca mais serão pedidas. Falta teto de
   tamanho e varredura periódica.

5. **Anime sincroniza item abandonado; as outras mídias não.** O `findStale` de anime não filtra
   por `status`, enquanto séries, filmes e jogos têm `status != 'dropped'` na query. Anime
   abandonado consome cota da API mais sensível do conjunto sem gerar notificação (o
   `detectAndNotify` já pula abandonado).

---

## 10. Regras ao mexer nisso

- **Nada de fan-out ilimitado.** Onde a API é 1 requisição por item (TMDB), fatie com concorrência
  fixa; onde aceita lote (AniList, IGDB), itere por lote.
- **`try/catch` dentro da unidade** — item ou lote —, nunca em volta do job inteiro. Um item ruim
  não pode custar o ciclo dos outros.
- **Coluna nova num `findStale*` torna a biblioteca inteira stale de uma vez.** Confira se o
  fatiamento aguenta e se a condição tem saída garantida (ver limitação 2).
- **Nunca sobrescreva título ou capa com valor vazio.** Use `COALESCE(NULLIF(...))`.
- **Job novo entra no `runSyncTick`** e é embrulhado em `singleFlight` + `notifyError`.
- **Não invente notificação no refresh.** Comparar estado antigo com novo é responsabilidade dos
  `detectAndNotify`; lançamento é do job das 09:00.
