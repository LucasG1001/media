# Dashboard (frontend)

O que a página `Dashboard` agrega, como os dois carrosséis de lançamentos se dividem e como a faixa
horizontal se comporta. Consulte antes de mexer em `utils/agenda.ts`, `utils/recentReleases.ts`,
`components/ReleaseCarousel/` ou `hooks/useDragScroll.ts`.

---

## 1. Agregação

O Dashboard **agrega no cliente**, sobre as 5 bibliotecas que os stores já carregam (nenhum
endpoint próprio). `utils/agenda.ts` cobre o que **vai** lançar; `utils/recentReleases.ts` cobre o
que **já** saiu, em dois carrosséis (`ReleaseCarousel`).

## 2. Os dois carrosséis

- **Finalizados recentemente** (`buildRecentReleases`, todas as mídias) — fila de "já dá para
  consumir": só entra item em `plan_to_*`, então marcar como concluído tira o item de lá.
- **Episódios recentes** (`buildRecentEpisodes`, só anime e séries — filme/jogo/livro não têm
  episódio) — o que segue saindo. Aqui o recorte é só "não abandonado", e **não** "falta
  consumir": episódio novo de série em que você está em dia é justamente o que se quer ver (mesma
  regra da notificação de novo episódio).

Os dois são **complementares por construção**: anime `FINISHED`/temporada encerrada vão para o
primeiro, anime `RELEASING`/temporada em andamento para o segundo. Ambos usam a mesma janela
(`applyWindow`): 90 dias, completada até um mínimo de 10 itens para não ficar vazio em período
parado. Em séries o item é a **temporada** (status lido de `season_states`, clique abre o
`SeasonDrawer`); linha antiga sem `season` no próximo episódio degrada para menos itens, nunca
para a temporada errada.

## 3. `ReleaseCarousel`

Card com a anatomia do `MediaCard` — capa com título por cima e a data relativa numa pílula acima
dele, mesma largura do `MediaGrid`.

Navega por arrasto via `hooks/useDragScroll.ts`, só no mouse — no touch a rolagem nativa já
resolve —, com deslize por atrito ao soltar e engolindo o clique do fim do arrasto para não abrir
o drawer.

A faixa **não** usa `scroll-snap`: ele brigava com o `scrollLeft` do arrasto e travava o
movimento ao soltar, puxando para o card mais próximo. A **barra de rolagem fica visível, mas fina**
(`scrollbar-width: thin` + `::-webkit-scrollbar { height: 4px }` na `.track`): o global só define
`width`, então sem essa altura a barra horizontal viria na espessura cheia do Chrome. Ela existe
porque no mouse é a única dica visível de que há mais card à direita, e conviver com o arrasto é de
graça: o `overflow-x` sempre foi `auto`.
