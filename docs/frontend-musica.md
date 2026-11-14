# Música (frontend e backend)

Música é a mídia do YouTube **sem coleção** — e, como tag só existe dentro de coleção, **sem tag**.
A fonte continua sendo a YouTube Data API (`youtubeService`, reaproveitado como está): o que muda é a
tabela (`music_library`), a API (`/api/music-library`) e a página (`/musica`), que **é a tela de
reprodução**: Música não tem grade de biblioteca nem drawer. Consulte antes de mexer em `MusicPage`,
`MusicWatch`, `MusicQueueControls`, `YoutubePlayer`, `utils/musicList.ts`, `utils/youtubeIframeApi.ts`, `useMusicLibrary`,
`musicLibraryModel`/`Controller` ou na ação "Mover para Música" do YouTube.

A organização interna de Música ainda **não está definida** — coleção e tag ficaram de fora de
propósito, à espera dessa decisão. Não antecipe uma.

---

## 1. Modelo

`music_library` tem as colunas de `youtube_library` menos `collection_id`, `is_cover` e `tags`, mais
`synced_at` (o job de refresh — `docs/sincronizacao.md` §2.10). Status `liked`/`removed`, `liked_at`
como timestamp de conclusão e `last_access_at` gravado **quando a música começa a tocar**
(`POST /:id/access` → `touchAccess`, sem tocar `updated_at`; ver §5). O
model sai da factory **sem `collectionColumn`**, então não há `setCover` nem rota de capa.

As duas bibliotecas são **independentes**: `video_id` é único por tabela, e o mesmo vídeo pode
existir nas duas se o link for colado nos dois lados.

`musicCreateSchema`/`musicUpdateSchema` derivam dos do YouTube com `tags` **omitido** — o campo é
descartado pelo Zod em vez de chegar ao model.

## 2. Entrada de músicas

- **Colar link** na página: vídeo único entra como `liked`; **playlist entra solta** (todas as faixas
  na lista, sem virar coleção). `bulkInsertTracks` usa `ON CONFLICT (video_id) DO NOTHING`, e a
  resposta traz `imported` (novas) e `total` (da playlist) — a diferença é o que já estava lá.
- **Mover do YouTube**: `POST /api/youtube-library/move-to-music` → `moveFromYoutube`, numa
  transação: copia o que é do vídeo e do usuário (nota, anotação, status, `liked_at`,
  `last_access_at`) e apaga a linha de origem; coleção, capa e tags ficam para trás. Se a música **já
  existe** em `music_library`, a linha de lá não é sobrescrita e o vídeo só sai do YouTube. Depois da
  transação o controller poda coleção que ficou vazia. **Não há caminho de volta** (Música → YouTube).

## 3. A ação "Mover para Música" no YouTube

Entra pelas `extraActions` do `FranchiseGrid` com **`anySelection: true`** — as outras ações extra
(tag em lote) exigem a seleção numa única coleção, e mover vale para qualquer seleção, inclusive
avulsos e coleções misturadas. Selecionar a capa de uma coleção seleciona todos os membros, então
move a coleção inteira.

No store, `moveToMusic` (em `useYoutubeLibrary`) **tira os movidos do slice do YouTube à mão**: o
`load` do `useLibraryStore` faz merge e mantém o que só existe localmente, então recarregar não os
removeria. O slice de Música é só marcado `loaded: false` e rebusca quando a página montar.

## 4. A página é a tela de reprodução

Não existe tela de biblioteca: `/musica` **redireciona** (`<Navigate replace>`) para
`/musica/:videoId` da **música inicial** (`pickInitialTrack`): a última tocada entre as curtidas;
sem nenhuma tocada, a primeira em ordem alfabética; removida só quando não há curtida. Um id que não
está (mais) na biblioteca cai no mesmo redirect. Biblioteca vazia mostra só a barra de colar link e
o aviso.

- **Uma rota só, com segmento opcional** (`/musica/:videoId?`): a `MusicPage` não desmonta ao trocar
  de música, então o player, a busca e a ordenação sobrevivem à troca. O `Sidebar` reconhece a mídia
  ativa por **prefixo** do caminho por causa disso.
- **Vídeo grande à esquerda, lista à direita** (abaixo do player até 1100 px). A barra de colar link
  fica no topo da página; adicionar não troca de música — o aviso verde é a confirmação.
- **Não há seleção em lote** (ela vivia na grade). Status, nota e remover são por música, no botão
  abaixo do vídeo (`YoutubeLibraryModal`; coleção e capa são opcionais nas props dele, e sem
  `onSetCover` o botão de capa não aparece). Remover a música atual segue para a próxima da lista.

## 5. A lista da direita

É a biblioteca inteira recortada por `visibleTracks` (`utils/musicList.ts`): aba de status → busca
(título/canal) → ordenação (Alfabética, Data, Visualizações, Último acesso; padrão Alfabética asc).
Os controles são o `MusicQueueControls`, que a página entrega ao `MusicWatch` pelo slot `controls`.
Música sem data vale `+Infinity` (não vira "a mais antiga") e o desempate por `videoId` **não
inverte com a direção** — ele só impede a ordem de trocar entre renders.

- **A lista é fixa**: escolher uma música **não a tira do lugar nem reordena o resto** — só muda
  qual linha está destacada (`aria-current`, fundo de acento e o selo ▶). Uma versão anterior mostrava
  só "as próximas", o que fazia a lista girar a cada clique; não volte a isso.
- **Anterior e próxima** saem de `trackNeighbors`, circular (depois da última vem a primeira). Música
  fora da lista (a aba ou a busca a escondem) tem a primeira como próxima e nenhuma anterior.
- **Reprodução automática**: ao terminar, toca a próxima. O interruptor fica em `localStorage`
  (`music-autoplay`; ausente = ligado).
- **Rolagem**: no desktop o painel é `sticky` e a lista rola por dentro; quando a música atual sai
  da parte visível (avanço automático), o `scrollTop` **da lista** é ajustado — não
  `scrollIntoView`, que rolaria a página junto. No celular a lista rola com a página, e a tela só
  sobe até o player se o topo dele já saiu da vista.
- **`MusicWatch` não leva `key` por música**, pelo mesmo motivo dos drawers
  (`docs/frontend-drawers.md` §2): remontar recriaria o player. O que dependia da remontagem é por
  id — o `NotesBlock` leva `key`, e a descrição expandida é guardada junto com o id a que pertence.
- **Acesso = tocar, não abrir.** A página abre numa música pausada sem ninguém ter pedido, então o
  `last_access_at` é gravado quando o player entra em "tocando", **uma vez por música** (pausar e
  retomar não conta de novo). É isso que mantém a "última tocada" do redirect honesta.

## 6. `YoutubePlayer` (IFrame Player API)

Diferente do `TrailerEmbed` dos drawers (iframe cru, `fs=0`, tela cheia do nosso wrapper), aqui o
player é criado pela **IFrame Player API** (`utils/youtubeIframeApi.ts` carrega o script uma vez),
porque só ela avisa quando o vídeo **começa a tocar**, **termina** e **não pode ser tocado**.

- **Controles e tela cheia são os nativos do YouTube** (play, volume, qualidade, atalhos). A
  contrapartida: em tela cheia só o iframe é pintado, então anterior/próximo ficam fora do vídeo —
  mas a reprodução automática segue funcionando lá, porque a troca é no mesmo player.
- **O player é criado uma vez e troca de vídeo por `loadVideoById`**. Recriá-lo a cada música
  derrubaria a tela cheia. O elemento-alvo é criado à mão dentro do `mount`, porque a API o
  **substitui** pelo iframe e o React não pode ser dono de um nó trocado por fora.
- **O primeiro vídeo entra pausado** (`autoplay: 0`): é a música em que a página abriu. Toda troca
  depois disso é escolha de alguém (clique na lista, anterior/próxima, avanço automático) e toca na
  hora, que é o comportamento do `loadVideoById`.
- **Vídeo que não toca embutido** (`onError`): 100 = removido/privado; 101 e 150 = o dono bloqueou a
  reprodução fora do YouTube — comum em clipe de gravadora, e na prática um id inexistente também
  chega como 150. No lugar do player entra a tela "Não dá para tocar aqui", com a miniatura
  desfocada ao fundo e o botão **Abrir no YouTube**. **A fila para ali, de propósito**: não pula
  sozinha. A falha é guardada junto com o `videoId`, então trocar de música a desfaz por derivação.
  Falha ao carregar o script da API cai na mesma tela.

## 7. Fora

Música não entra no Dashboard nem no Tier List. Não há aleatório, prévia no hover nem recomendação
externa (o `relatedToVideoId` da API foi desligado em agosto de 2023).
