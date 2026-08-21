# Séries = coleção de temporadas (frontend)

Por que a coleção de uma série não vem de linhas do banco, como cada temporada se comporta como um
item e por que a nota da série é sempre a média. Consulte antes de mexer em `utils/seasonGroups.ts`,
`SeasonDrawer`, `SeasonLibraryModal`, `SeriesDrawer/SeriesDetailBody.tsx` ou nos endpoints de
temporada.

Os invariantes gerais de coleção (agrupamento, filtro, ordenação, "capa é só coleção") estão em
`docs/frontend-colecoes.md` e valem aqui também.

---

## 1. A coleção é sintetizada

`utils/seasonGroups.ts` (`buildSeasonGroups`): a coleção **NÃO** vem de linhas do banco — cada série
é **1 linha** e os membros (temporadas) são sintetizados do JSONB `season_list` (metadado) +
`season_states` (estado do usuário por temporada: `{status,score,notes,lastAccessAt}`).

**Cada temporada se comporta como um filme da coleção**: card com botão de status colorido + nota
própria. Representante = a série (nome + capa: pôster da temporada `cover_season`, senão da série),
sujeito à regra `coverIsCollectionOnly`.

## 2. Interação nos membros

- Clique na **imagem** → `SeasonDrawer`, que traz **os dados da série** (banner, trailer, gêneros,
  onde assistir, grade de 5 infos — corpo compartilhado `SeriesDrawer/SeriesDetailBody.tsx`, com
  overrides de pôster/tagline/sinopse da temporada) **+ a lista de episódios**
  (`GET /api/series/:id/season/:n`).
- Clique no **botão de status** → `SeasonLibraryModal` (`LibraryModalBase`, status/nota + "Definir
  como capa"; `onSetCover` e `onRemove` são opcionais — temporada de coleção não se remove sozinha)
  → `saveSeason` (`PUT /:id/seasons/:n`, `setSeasonState` recalcula `score` da série = média das
  notas > 0) e `setCoverSeason` (`PUT /:id/cover-season/:n`).

`setSeasonState` **mescla** no estado atual da temporada em vez de substituí-lo: o modal não manda a
anotação e não pode apagá-la.

## 3. A nota da série é sempre a média

A coluna `score` de `series_library` é **sempre** a média das temporadas — nunca uma nota própria:
antes das temporadas o modal da série tinha campo Nota, e essas notas legadas viravam "nota
fantasma" em série sem temporada avaliada. Por isso a nota exibida vem de `seasonGroups` +
`averageScore` (nunca de `entry.score`) e o `migrate()` zera `score` de linha com nota mas sem
temporada avaliada (roda a cada boot; só bate em linha inconsistente).

## 4. Filtro, seleção e remoção

Filtro de status age **por temporada** (member-level, como filmes; esconde só séries 100% dropadas
quando sem filtro); sem seleção/bulk. Remover a série = lixeira do `FranchiseCard`.

## 5. Os dois casos que **não** são coleção

Card simples, sem `getCollectionKey`:

- Série de **1 temporada** (`isOnlySeason`) — card mostra nome/capa da série mas carrega o estado da
  temporada; botão de status abre o `SeasonLibraryModal` **com remover** (remove a série) e **sem**
  "definir como capa".
- Série **sem `season_list`** — fallback de 1 membro `kind:"series"`: botão de status →
  `SeriesLibraryModal`, imagem → `SeriesDrawer`.

## 6. Update otimista

`store.mutate` = primitivo de update otimista com endpoint custom (usado por
`saveSeason`/`setCoverSeason`).
