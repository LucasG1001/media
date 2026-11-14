# Música (frontend e backend)

Música é a mídia do YouTube **sem coleção** — e, como tag só existe dentro de coleção, **sem tag**.
A fonte continua sendo a YouTube Data API (`youtubeService`, reaproveitado como está): o que muda é a
tabela (`music_library`), a API (`/api/music-library`) e a página (`/musica`). Consulte antes de mexer
em `MusicPage`, `utils/musicList.ts`, `useMusicLibrary`, `musicLibraryModel`/`Controller` ou na ação
"Mover para Música" do YouTube.

A organização interna de Música ainda **não está definida** — coleção e tag ficaram de fora de
propósito, à espera dessa decisão. Não antecipe uma.

---

## 1. Modelo

`music_library` tem as colunas de `youtube_library` menos `collection_id`, `is_cover` e `tags`. Status
`liked`/`removed`, `liked_at` como timestamp de conclusão e `last_access_at` gravado **ao abrir o
drawer** (`POST /:id/access` → `touchAccess`, sem tocar `updated_at`) — as mesmas regras do YouTube,
descritas em `CLAUDE.md`. O model sai da factory **sem `collectionColumn`**, então não há `setCover`
nem rota de capa.

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

## 4. Página

`MusicPage` usa o mesmo `FranchiseGrid`, com **cada música como grupo de um só** (`toMusicGroups`) e
**sem as props de coleção** — é isso que faz as ações de agrupar sumirem da `SelectionBar`. O
pipeline fica em `utils/musicList.ts` (`visibleTracks`): aba de status → busca (título/canal) →
ordenação (Alfabética, Data, Visualizações, Último acesso; padrão Alfabética asc). Música sem data
vale `+Infinity` (não vira "a mais antiga") e o desempate por `videoId` **não inverte com a
direção** — ele só impede a ordem de trocar entre renders.

**Anterior/próximo do drawer percorre a lista visível inteira**: sem coleção para delimitar a
sequência, a página passa ao `collectionNav` um pseudo-grupo com todas as músicas de `visibleTracks`.

## 5. O que é compartilhado com o YouTube

- **`YoutubeDrawer`** e **`YoutubeLibraryModal`**: as props aceitam só os campos que cada um lê
  (`YoutubeDrawerEntry`; no modal, coleção e capa são opcionais), então a entrada de Música serve sem
  cópia. Sem `onSetCover` o botão de capa não aparece. As regras do drawer (sem `key`, acesso por
  troca de id) estão em `docs/frontend-drawers.md` e valem igual.
- **Card**: `musicCardConfig` e `youtubeCardConfig` usam o mesmo `renderVideoBelow`; o do YouTube só
  acrescenta a linha de chips.
- **CSS**: `MusicPage` importa `YouTubePage.module.css` (faixa de adicionar e grade 16:9) em vez de
  copiá-lo. Mudança visual que deva valer só para uma das duas páginas pede um módulo próprio.

## 6. Fora

Música não entra no Dashboard, no Tier List nem em job de refresh — como o YouTube.
