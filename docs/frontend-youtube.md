# YouTube: músicas e vídeos na tela de reprodução (frontend e backend)

A mídia YouTube guarda **músicas e vídeos na mesma biblioteca**, separados por `kind`, e **não tem
grade de biblioteca nem drawer**: a página é a tela de reprodução, com o player à esquerda e a
biblioteca como lista ao lado. Não existem mais coleções nem tags (os dois modelos foram removidos,
código e dados). Consulte antes de mexer em `YouTubePage`, `YoutubeWatch`, `YoutubeListControls`,
`YoutubePlayer`, `utils/youtubeList.ts`, `utils/youtubeIframeApi.ts`, `useYoutubeLibrary` ou em
`youtubeLibraryModel`/`Controller`.

---

## 1. Modelo

`youtube_library` tem os dados do vídeo (título, canal, miniatura, duração, visualizações, data,
descrição), `kind` (`'music'` | `'video'`, default `'video'`), status `liked`/`removed`, `liked_at`
como timestamp de conclusão, `last_access_at`, `synced_at` (job de refresh — `docs/sincronizacao.md`
§2.10) e `notes`. O model sai da factory **sem `collectionColumn`**: não há `setCover` nem rota de
capa.

- **Mover de aba é um `UPDATE` de `kind`** pelo `PUT /:id` de sempre (update otimista do store) —
  não há endpoint próprio.
- **`last_access_at` é gravado quando o item começa a tocar** (`POST /:id/access` → `touchAccess`,
  sem tocar `updated_at`), não ao abrir — ver §4.
- **O que o `migrate()` faz em banco antigo**: adiciona `kind`/`synced_at` (o que já existia vira
  `video`); funde a antiga `music_library` como `kind = 'music'` e a remove (bloco `DO $$` guardado
  por `to_regclass`, então roda uma vez); derruba `collection_id`, `is_cover`, `tags` e a tabela
  `youtube_collection`. Vídeo que existia nas duas tabelas fica numa linha só, como música.
- **Backup**: a chave `youtube` leva `kind`. O import aceita arquivo de antes da fusão pelo
  `lib/backupLegacy.ts` (`youtubeRowsFromBackup`): linha sem `kind` é vídeo, a chave antiga `music`
  entra como música (depois dos vídeos, para vencer um vídeo repetido) e `youtubeCollections` é
  ignorada.

## 2. Entrada

Colar link na barra do topo: vídeo único entra como `liked`, **no tipo da aba ativa**; **playlist
entra solta**, também no tipo da aba ativa (`bulkInsertVideos`, `ON CONFLICT (video_id) DO NOTHING`
— item que já existe fica como está, inclusive o tipo). A resposta traz `imported` (novos) e `total`
(da playlist). Adicionar não troca de item: o aviso verde é a confirmação. Com a biblioteca vazia
não há lista, então as abas de tipo aparecem dentro do aviso de vazio.

## 3. A página é a tela de reprodução

Não existe tela de biblioteca: `/youtube` **redireciona** (`<Navigate replace>`) para
`/youtube/:videoId` do **item inicial** (`pickInitialTrack`): o último tocado entre os curtidos, de
qualquer tipo; sem nenhum tocado, o primeiro em ordem alfabética; removido só quando não há curtido.
Um id que não está (mais) na biblioteca cai no mesmo redirect. `/musica/*` (rota da antiga mídia
Música) redireciona para `/youtube`.

- **Uma rota só, com segmento opcional** (`/youtube/:videoId?`): a `YouTubePage` não desmonta ao
  trocar de item, então o player, a busca e a ordenação sobrevivem à troca. O `Sidebar` reconhece a
  mídia ativa por **prefixo** do caminho por causa disso.
- **Não há seleção em lote.** Status, nota e remover são por item, no botão abaixo do vídeo
  (`YoutubeLibraryModal`). Remover o item atual segue para o próximo da ordem de reprodução.

## 4. A lista da direita

É a biblioteca recortada por `visibleTracks` (`utils/youtubeList.ts`): **aba de tipo**
(Músicas | Vídeos) → aba de status → busca (título/canal) → ordenação (Alfabética, Data,
Visualizações, Último acesso; padrão Alfabética asc). As abas de tipo ficam no cabeçalho do painel;
o resto é o `YoutubeListControls`, entregue ao `YoutubeWatch` pelo slot `controls`. Item sem data
vale `+Infinity` (não vira "o mais antigo") e o desempate por `videoId` **não inverte com a
direção** — ele só impede a ordem de trocar entre renders.

- **A aba acompanha o item aberto até alguém escolher.** `kindChoice` começa `null` e a aba ativa é
  `kindChoice ?? watchEntry.kind`: abrir a página cai na aba do item tocado. Clicar numa aba fixa a
  escolha — e **mover um item também fixa**, senão mover o próprio item que toca levaria a lista
  junto para a outra aba.
- **A lista é fixa**: escolher um item **não o tira do lugar nem reordena o resto** — só muda qual
  linha está destacada (`aria-current`, fundo de acento e o selo ▶). Uma versão anterior mostrava só
  "os próximos", o que fazia a lista girar a cada clique; não volte a isso.
- **Botão de mover em cada linha** ("→ Músicas" / "→ Vídeos"): manda o item para a outra aba sem
  abri-lo. É **irmão** do botão da linha, não filho (botão dentro de botão é HTML inválido);
  aparece no hover e fica sempre visível em `@media (hover: none)`. O destino sai do `kind` do item,
  não da aba. O mesmo botão existe abaixo do player para o item atual.
- **Reprodução automática**: ao terminar, toca o próximo. O interruptor fica em `localStorage`
  (`youtube-autoplay`; ausente = ligado).
- **Rolagem**: no desktop o painel é `sticky` (logo abaixo da barra superior — `top` e `max-height`
  descontam `--topbar-height`) e a lista rola por dentro; quando o item atual sai da
  parte visível (avanço automático), o `scrollTop` **da lista** é ajustado — não `scrollIntoView`,
  que rolaria a página junto. No celular a lista rola com a página, e a tela só sobe até o player se
  o topo dele já saiu da vista.
- **`YoutubeWatch` não leva `key` por item**, pelo mesmo motivo dos drawers
  (`docs/frontend-drawers.md` §2): remontar recriaria o player. O que dependia da remontagem é por
  id — o `NotesBlock` leva `key`, e a descrição expandida é guardada junto com o id a que pertence.
- **Acesso = tocar, não abrir.** A página abre num item pausado sem ninguém ter pedido, então o
  `last_access_at` é gravado quando o player entra em "tocando", **uma vez por item** (pausar e
  retomar não conta de novo). É isso que mantém o "último tocado" do redirect honesto.

## 5. Agrupar por canal

Interruptor nos controles (`localStorage`: `youtube-group-by-channel`). Ligado, a lista mostra os
**canais** (avatar, nome, contagem) em vez dos itens; clicar num canal o abre e a lista volta ao
formato de sempre, só com os itens dele. A barra **"← Todos os canais"** fica **fora** da área que
rola, para estar à mão em canal comprido.

- `channelGroups` agrupa a lista **já recortada e ordenada** por `visibleTracks`, então dentro do
  canal vale a ordenação normal e a busca tira de vista o canal sem item casando.
- **Os canais seguem o critério escolhido, agregado**: Alfabética = nome do canal; Visualizações =
  soma; Data = publicação mais recente (só os datados contam); Último acesso = acesso mais recente.
- **A chave do grupo é o `channelId`** (o nome pode mudar e pode repetir); item antigo sem id cai no
  nome, e sem os dois vai para "Canal desconhecido".
- **Canal aberto é derivado**: a página guarda só a chave (`openChannelKey`) e procura o grupo a
  cada render. Canal que a busca ou a aba tiraram de vista deixa de estar aberto sozinho; trocar de
  aba ou desligar o agrupamento zera a chave.
- **Anterior/próximo e a reprodução automática seguem `playOrder`**, que a página calcula: lista
  plana → a lista; canal aberto → só o canal; agrupado sem canal aberto → todos os itens, na ordem
  dos canais. As linhas mostradas (`tracks`) e a ordem de reprodução são props separadas no
  `YoutubeWatch` por causa desse último caso.
- Na lista de canais o destaque marca o **canal do item que está tocando**.

## 6. `YoutubePlayer` (IFrame Player API)

Diferente do `TrailerEmbed` dos drawers (iframe cru, `fs=0`, tela cheia do nosso wrapper), aqui o
player é criado pela **IFrame Player API** (`utils/youtubeIframeApi.ts` carrega o script uma vez),
porque só ela avisa quando o vídeo **começa a tocar**, **termina** e **não pode ser tocado**.

- **Controles e tela cheia são os nativos do YouTube** (play, volume, qualidade, atalhos). A
  contrapartida: em tela cheia só o iframe é pintado, então anterior/próximo ficam fora do vídeo —
  mas a reprodução automática segue funcionando lá, porque a troca é no mesmo player.
- **O player é criado uma vez e troca de vídeo por `loadVideoById`**. Recriá-lo a cada item
  derrubaria a tela cheia. O elemento-alvo é criado à mão dentro do `mount`, porque a API o
  **substitui** pelo iframe e o React não pode ser dono de um nó trocado por fora.
- **O primeiro vídeo entra pausado** (`autoplay: 0`): é o item em que a página abriu. Toda troca
  depois disso é escolha de alguém (clique na lista, anterior/próximo, avanço automático) e toca na
  hora, que é o comportamento do `loadVideoById`.
- **Vídeo que não toca embutido** (`onError`): 100 = removido/privado; 101 e 150 = o dono bloqueou a
  reprodução fora do YouTube — comum em clipe de gravadora, e na prática um id inexistente também
  chega como 150. No lugar do player entra a tela "Não dá para tocar aqui", com a miniatura
  desfocada ao fundo e o botão **Abrir no YouTube**. **A fila para ali, de propósito**: não pula
  sozinha. A falha é guardada junto com o `videoId`, então trocar de item a desfaz por derivação.
  Falha ao carregar o script da API cai na mesma tela.

## 7. Fora

O YouTube não entra no Dashboard nem no Tier List. Não há aleatório, prévia no hover nem
recomendação externa (o `relatedToVideoId` da API foi desligado em agosto de 2023).
