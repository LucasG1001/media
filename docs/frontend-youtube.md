# YouTube: músicas e vídeos na tela de reprodução (frontend e backend)

A mídia YouTube guarda **músicas e vídeos na mesma biblioteca**, separados por `kind`, e **não tem
grade de biblioteca nem drawer**: a página é a tela de reprodução, com o player à esquerda e a
biblioteca como lista ao lado. Coleções e tags não existem mais (os dois modelos foram removidos,
código e dados); a única organização é a **playlist** (§6), que é N:N e tem ordem própria. Consulte
antes de mexer em `YouTubePage`, `YoutubeWatch`, `YoutubeListControls`, `YoutubePlaylistPicker`,
`YoutubePlaylistActions`, `YoutubeSelectionBar`, `YoutubePlayer`, `utils/youtubeList.ts`,
`utils/youtubeIframeApi.ts`, `useYoutubeLibrary`, `useYoutubePlaylists` ou em
`youtubeLibraryModel`/`Controller` e `youtubePlaylistModel`/`Controller`.

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
- **Playlists** moram em duas tabelas à parte — `youtube_playlist` (`name`, `kind`; índice único em
  `(kind, LOWER(name))`) e `youtube_playlist_item` (`playlist_id`, `entry_id`, `position`; `ON DELETE
  CASCADE` nos dois lados) — e **não tocam `youtube_library`** nem a factory dela. O nome
  `youtube_collection` não pode ser reaproveitado: o `migrate()` derruba essa tabela a cada boot.
  - API em `/api/youtube-library/playlists` (montada **antes** da biblioteca, para não cair no
    `/:id` de lá): `GET /` devolve `{id, name, kind, itemIds[]}` com os ids da biblioteca na ordem
    da playlist; `POST /` cria (aceita `entryIds`), `PUT /:id` renomeia, `DELETE /:id` exclui só a
    playlist; `POST /:id/items` acrescenta no fim (idempotente — quem já está fica onde está, id
    que não existe é ignorado) e `POST /:id/items/remove` tira. Nome repetido na aba dá `409`.
  - **O vínculo sobrevive a "removido" e a mover de aba.** O servidor guarda tudo; quem esconde o
    item `removed` ou de outro `kind` é a tela (`playlistGroups`), então restaurar ou mover de volta
    devolve o item ao lugar em que estava. Só o `DELETE` do item na biblioteca desfaz (cascade).
  - **Backup**: chave `youtubePlaylists`, com os itens por **`video_id`** (o uuid da linha muda em
    outro banco). O import roda depois das linhas do YouTube, funde por `(kind, nome)` e só
    acrescenta. Arquivo antigo, sem a chave, importa normalmente
    (`youtubePlaylistsFromBackup` descarta playlist sem nome ou de tipo desconhecido).

## 2. Entrada

O campo de link fica na **barra superior** no desktop (`TopbarSlot`, ver
`docs/frontend-componentes.md` §7) e no topo da página no celular; os avisos de erro e de
"adicionado" ficam sempre na página. Colar o link: vídeo único entra como `liked`, **no tipo da aba ativa**; **playlist
entra solta**, também no tipo da aba ativa (`bulkInsertVideos`, `ON CONFLICT (video_id) DO NOTHING`
— item que já existe fica como está, inclusive o tipo). A resposta traz `imported` (novos), `total`
(da playlist) e `videoIds` (todos, na ordem do YouTube, inclusive os que já estavam). Adicionar não
troca de item: o aviso verde é a confirmação. Com a biblioteca vazia não há lista, então as abas de
tipo aparecem dentro do aviso de vazio.

Depois de uma playlist colada, o aviso verde ganha o botão **"Criar playlist «nome»"** (ou
"Adicionar à playlist «nome»" se a aba já tem uma com esse nome): junta numa playlist daqui os itens
daquele link, na ordem do YouTube — **só os do tipo da aba em que o link foi colado** (o que já
estava na biblioteca como o outro tipo fica de fora). É uma oferta, não automático: colar continua
entrando solto. É uma cópia do momento; não há vínculo com a playlist do YouTube.

## 3. A página é a tela de reprodução

Não existe tela de biblioteca: `/youtube` **redireciona** (`<Navigate replace>`) para
`/youtube/:videoId` do **item inicial** (`pickInitialTrack`): o último tocado entre os curtidos, de
qualquer tipo; sem nenhum tocado, o primeiro em ordem alfabética; removido só quando não há curtido.
Um id que não está (mais) na biblioteca cai no mesmo redirect. `/musica/*` (rota da antiga mídia
Música) redireciona para `/youtube`.

- **Uma rota só, com segmento opcional** (`/youtube/:videoId?`): a `YouTubePage` não desmonta ao
  trocar de item, então o player, a busca e a ordenação sobrevivem à troca. O `Sidebar` reconhece a
  mídia ativa por **prefixo** do caminho por causa disso.
- **Status, nota e remover são por item**, no botão abaixo do vídeo (`YoutubeLibraryModal`).
  Remover o item atual segue para o próximo da ordem de reprodução. A seleção em lote existe só
  para mandar itens a uma playlist (§6).
- **`?list=<playlistId>` é o contexto de reprodução**: de qual playlist o item está tocando (§6).
  Sem ele a página se comporta como sempre.

## 4. A lista da direita

É a biblioteca recortada por `visibleTracks` (`utils/youtubeList.ts`): **aba de tipo**
(Músicas | Vídeos) → status → busca (título/canal) → ordenação (Alfabética, Data,
Visualizações, Último acesso; padrão Alfabética asc). Item sem data
vale `+Infinity` (não vira "o mais antigo") e o desempate por `videoId` **não inverte com a
direção** — ele só impede a ordem de trocar entre renders.

- **Os controles ocupam duas linhas, de propósito**: cada linha a mais é um item a menos à vista.
  O cabeçalho do painel tem as abas de tipo e a **contagem** da lista de baixo (plana ou agrupada
  por canal — as playlists do topo repetem itens dela e não entram na conta); abaixo vem o
  `YoutubeListControls` (slot `controls`), uma linha só: busca + cinco botões de ícone (ordenar,
  agrupar por canal, mostrar playlists, selecionar vários, mostrar removidos). Abaixo de 480 px a
  busca ganha a linha inteira e os botões descem — lá a lista rola com a página e a linha a mais
  custa pouco.
  - **Ordenar** abre um menu (`role="menu"`) com os critérios; o ativo mostra a seta, e escolhê-lo
    de novo inverte a direção (contrato do `useSingleSort`) — por isso o menu **não fecha ao
    escolher**, só com `Escape`, clique fora ou no próprio botão. Não usa o `ControlPopover` das
    outras páginas: o painel dele é largo (feito para os filtros) e aqui basta um menu.
  - **Agrupar por canal** e **Mostrar removidos** são botões liga/desliga (`aria-pressed`). O
    status não tem abas: "removido" é raro e o botão alterna `liked` ↔ `removed`.
- **Música e vídeo usam a mesma linha** (miniatura grande, de 200 px, com a duração por cima, título
  em duas linhas, canal e visualizações). Uma linha compacta só para música foi testada e
  descartada: a miniatura pequena ficou pior.
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
- **Reprodução automática**: ao terminar, toca o próximo. O interruptor é o botão "Auto" ao lado de
  anterior/próximo, abaixo do player (é ajuste de reprodução, não filtro da lista), e fica em
  `localStorage` (`youtube-autoplay`; ausente = ligado).
- **Rolagem**: no desktop o painel é `sticky` (logo abaixo da barra superior — `top` e `max-height`
  descontam `--topbar-height`) e a lista rola por dentro; quando o item atual sai da
  parte visível (avanço automático), o `scrollTop` **da lista** é ajustado — não `scrollIntoView`,
  que rolaria a página junto. No celular a lista rola com a página e o **player fica fixo no topo**,
  de borda a borda: escolher um item troca o vídeo sem mexer na rolagem. Descrição e anotação ficam
  atrás do botão "Mostrar detalhes", e os botões de ação viram uma linha só que rola de lado. O
  mecanismo é o mesmo da visão de detalhe — ver `docs/frontend-visao-detalhe.md` §8.
- **`YoutubeWatch` não leva `key` por item**, pelo mesmo motivo dos drawers
  (`docs/frontend-drawers.md` §2): remontar recriaria o player. O que dependia da remontagem é por
  id — o `NotesBlock` leva `key`, e a descrição expandida é guardada junto com o id a que pertence.
- **Acesso = tocar, não abrir.** A página abre num item pausado sem ninguém ter pedido, então o
  `last_access_at` é gravado quando o player entra em "tocando", **uma vez por item** (pausar e
  retomar não conta de novo). É isso que mantém o "último tocado" do redirect honesto.

## 5. Agrupar por canal

Botão liga/desliga nos controles (`localStorage`: `youtube-group-by-channel`). Ligado, a lista
mostra os **canais** (avatar, nome, contagem) em vez dos itens, em **sanfona**: clicar num canal
abre os itens dele **logo abaixo, na própria lista** (a seta gira e o bloco vira um cartão), e
clicar de novo fecha. Vários canais podem ficar abertos e os outros não saem do lugar — o mesmo
desenho das coleções da visão de detalhe (`docs/frontend-visao-detalhe.md` §4). Uma versão anterior
trocava a lista pelos itens do canal, com uma barra "← Todos os canais"; não volte a isso.

- `channelGroups` agrupa a lista **já recortada e ordenada** por `visibleTracks`, então dentro do
  canal vale a ordenação normal e a busca tira de vista o canal sem item casando.
- **Os canais seguem o critério escolhido, agregado**: Alfabética = nome do canal; Visualizações =
  soma; Data = publicação mais recente (só os datados contam); Último acesso = acesso mais recente.
- **A chave do grupo é o `channelId`** (o nome pode mudar e pode repetir); item antigo sem id cai no
  nome, e sem os dois vai para "Canal desconhecido".
- **A página guarda só as chaves dos canais abertos** (`openChannels`, um conjunto): canal que a
  busca tirou de vista não é desenhado e volta aberto quando reaparece; trocar de aba ou desligar o
  agrupamento esvazia o conjunto.
- **Anterior/próximo e a reprodução automática seguem `playOrder`**, que a página calcula: lista
  plana → a lista; agrupada → todos os itens, na ordem dos canais, **estejam abertos ou não** (a
  reprodução atravessa de um canal para o seguinte); tocando de dentro de uma playlist → os itens
  dela (§6). As linhas mostradas (`tracks`) e a ordem de reprodução são props separadas no
  `YoutubeWatch` por causa disso.
- O destaque marca o **canal do item que está tocando** enquanto ele está fechado; aberto, quem
  aparece marcado é o item dentro dele.

## 6. Playlists

Uma playlist é de **uma aba só** (músicas ou vídeos), um item pode estar em **várias**, e a ordem
dentro dela é a **ordem de adição** (`position`), não a ordenação da lista. Não há reordenação
manual.

- **O bloco de playlists é um botão à parte** (`localStorage`: `youtube-show-playlists`),
  independente de "Agrupar por canal". Ligado, as playlists da aba entram **no topo da lista**, em
  sanfona (o mesmo `groupRow` dos canais, com miniatura retangular no lugar do avatar), e os itens
  — ou os canais — **continuam embaixo**, depois de um divisor. O mesmo item aparece nos dois
  lugares, de propósito.
- **Dos filtros, só a busca chega nas playlists** (`playlistGroups`): casa com título/canal dos
  itens (playlist sem nenhum casando sai de vista) **ou com o nome da playlist** (que então aparece
  inteira). Ordenação e "Mostrar removidos" são da lista de baixo. Sem busca, playlist vazia
  aparece — é assim que se vê a recém-criada.
- **Contexto de reprodução (`?list=`)**. Escolher um item **de dentro** de uma playlist navega para
  `/youtube/:videoId?list=<id>`; a partir daí `playOrder` são os itens dela, então
  anterior/próximo/automático ficam presos ali, **em loop**. Escolher na lista de baixo navega sem
  `list` e sai. O contexto mora na URL porque ela só identificava o vídeo, e o mesmo vídeo está em
  mais de uma lista da tela: é o `list` que diz **qual linha destacar** (`activePlaylistId` — só a
  linha de dentro da playlist ativa leva `aria-current`; com ela fechada, o cabeçalho dela; a linha
  da lista de baixo e o canal do item ficam sem destaque).
  - O contexto **só vale com a playlist na tela**: bloco desligado, outra aba ou playlist escondida
    pela busca → a reprodução volta a seguir a lista de baixo, e retoma a playlist quando ela
    reaparece (o `list` continua na URL). É derivação, sem efeito para limpar a URL.
  - Abrir a página já com `?list=` mostra essa playlist aberta.
- **Aleatório** (`localStorage`: `youtube-shuffle`): botão ao lado de "Auto", que **só existe
  tocando de dentro de uma playlist**. Embaralha a **ordem de reprodução**, não as linhas — a lista
  é fixa (§4). `shuffleTracks` ordena por um hash de `semente + videoId`: a ordem não muda entre
  renders (senão o "próximo" pularia a cada troca) e tirar ou pôr um item não reembaralha os
  outros. Ligar de novo sorteia outra semente.
- **Pôr e tirar itens**:
  - **Item atual**: botão "Playlists" abaixo do player (`YoutubePlaylistPicker` com `single`) —
    lista as playlists **do tipo do item** com marcação; clicar alterna e o menu fica aberto. O
    rótulo diz em quantas ele está ("Playlists · 2").
  - **Em lote**: o botão "Selecionar vários" liga o modo de seleção, em que clicar numa linha
    **marca em vez de tocar** (inclusive a do item atual) e os botões de linha somem. Shift+clique
    marca o intervalo desde o último clicado **dentro da mesma lista** (a lista de baixo, um canal
    ou uma playlist — `toggleSelection`); cada cabeçalho de grupo ganha uma caixa que marca o grupo
    inteiro. A `YoutubeSelectionBar` (slot `footer`) fica à vista o modo inteiro, com "Todos" (a
    lista de baixo) e "Adicionar à playlist", que abre o mesmo menu para cima — aqui ele **só
    adiciona** e fecha. Os itens entram na ordem em que foram marcados. Trocar de aba ou de status
    esvazia a seleção (playlist não mistura tipos).
  - **Tirar**: dentro de uma playlist o botão de hover da linha é "✕ Tirar" no lugar de "→ Músicas".
  - Criar ("Nova playlist…") é pelo menu, nos dois casos; em lote e na oferta do link colado (§2)
    a playlist que recebeu os itens aparece (o bloco liga e ela abre).
- **Renomear e excluir** ficam **dentro da playlist aberta** (`YoutubePlaylistActions`), não num
  menu flutuante: a lista tem rolagem própria e cortaria um popover ancorado na linha. Excluir pede
  confirmação e não apaga os itens.
- **O menu vira folha de rodapé no celular** (`position: fixed`): o gatilho mora numa linha que
  rola de lado (os botões abaixo do player), que cortaria um menu ancorado.
- **`useYoutubePlaylists`** é otimista com rollback, mas lê a lista corrente de uma **ref**: o
  snapshot não pode sair de dentro de um updater do `setState`, que o React pode rodar só no
  próximo render — numa falha rápida o rollback restauraria lista vazia.

## 7. `YoutubePlayer` (IFrame Player API)

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

## 8. Fora

O YouTube não entra no Dashboard nem no Tier List. Não há aleatório fora de playlist, reordenação
manual de playlist, sincronia com playlist do YouTube, prévia no hover nem recomendação externa (o
`relatedToVideoId` da API foi desligado em agosto de 2023).
