# Jogos: visão de detalhe da biblioteca (frontend)

A biblioteca de Jogos tem **duas visualizações** da mesma lista de coleções, alternadas pelo
`ViewToggle` na barra da biblioteca: a **Grade** (`FranchiseGrid`, a de sempre) e o **Detalhe**
(`GameWatch`): palco grande à esquerda e as coleções como lista à direita, no desenho da tela do
YouTube. É um **experimento só em Jogos**, para comparar as duas; as outras mídias só têm a grade.
Consulte antes de mexer em `GameWatch`, `utils/gameWatch.ts`, `ViewToggle`, `useGameDetail`,
`GameDetailSections` ou no trecho de visualização da `GamesPage`.

---

## 1. O que é da página e o que é do `GameWatch`

- A escolha fica em `localStorage` (`games-library-view`; ausente = grade) e só vale na aba
  **Minha Biblioteca** — catálogo (Populares, Em Breve, Buscar) é sempre grade com drawer.
- **A lista é o mesmo `collectionGroups` da grade**: filtros, busca e ordenação da `LibraryControls`
  valem igual, e os invariantes de `docs/frontend-colecoes.md` continuam (o filtro decide quais
  coleções aparecem; a coleção aberta mostra **todos** os membros). Por isso os filtros ficam na
  barra do topo, não dentro do painel.
- **Não há rota por jogo**: o jogo aberto é estado da página (`watchChoice`). O que está no palco é
  derivado por `pickWatchEntry`: o escolhido enquanto a coleção dele estiver na tela, senão o
  **primeiro jogo da primeira coleção** — sem efeito para consertar a escolha quando o filtro muda.
  Sem nenhum jogo para mostrar (vazio, carregando, filtro sem resultado) a página cai na grade, que
  já tem esses estados.
- **Seleção em lote e remover coleção existem só na grade.** No Detalhe, status, nota, capa da
  coleção e remover saem do botão abaixo do palco, que abre o `GameLibraryModal` de sempre.

## 2. O palco

Jogo não é vídeo, então o palco cai em degraus, sempre na mesma caixa 16:9 (a altura não muda entre
um jogo com trailer e um sem): **trailer** (`TrailerEmbed`, o mesmo dos drawers) → **banner ou
primeira screenshot** → **capa**, inteira e centralizada. Enquanto o detalhe carrega fica a capa, e o
título vem da entrada da biblioteca na hora.

- **O trailer só toca sozinho para um jogo escolhido nesta visita** (`trailerArmed` na página +
  escolha igual ao jogo do palco). A tela abre num item que ninguém pediu, e trocar de aba ou de
  visualização desarma — voltar para a tela não é pedir de novo.
- Abaixo do palco: título, estúdios, ações e o detalhe (`GameDetailSections` com `wide`). O
  `NotesBlock` fica **fora** do ramo de sucesso, com `key` por item: quando o detalhe falha entra o
  aviso de dados salvos e a anotação continua lá.
- **`GameWatch` não leva `key` por jogo**, pelo mesmo motivo dos drawers
  (`docs/frontend-drawers.md` §2).

## 3. A lista da direita

Dois níveis, como o "agrupar por canal" do YouTube:

- **Coleção de 2+ jogos** aparece como coleção (capa e título do representante, contagem, nota
  média); clicar **abre a coleção na lista**, sem trocar o jogo do palco. Aberta, mostra os jogos
  dela com a barra **"← Todas as coleções"** fora da área que rola. Coleção que o filtro tirou de
  vista deixa de estar aberta por derivação (a página guarda só a chave).
- **Coleção de 1 jogo é o próprio jogo**: a linha abre direto no palco.
- A contagem da coleção é `count`; com filtro vira `que batem/total`, igual ao selo da grade.
- O destaque (`aria-current`) marca o jogo aberto ou, na lista de coleções, a coleção dele.
- **A miniatura é retrato** (capa de jogo), não a 16:9 do YouTube.
- **Anterior/próximo andam pela coleção do jogo aberto** (`collectionNav`, a mesma sequência do
  drawer): botões abaixo do palco com a posição, setas sobre o trailer e ← → do teclado (ignoradas
  digitando e com modal aberto — `navKeys`). Jogo avulso não tem navegação.

## 4. O que não veio do YouTube

Reprodução automática de item em item (trailer não é playlist), o player da IFrame API, mover entre
abas e gravar último acesso ao tocar — em jogos o `last_access_at` continua dirigido por status.

## 5. Compartilhado com o `GameDrawer`

`hooks/useGameDetail.ts` (busca o detalhe e guarda o payload junto com o id) e
`components/GameDetailSections` (screenshots, descrição, ficha, gêneros, lojas — um fragmento, o
espaçamento é de quem monta) saíram do `GameDrawer` para as duas telas usarem o mesmo miolo.

O CSS de layout do `GameWatch` repete o do `YoutubeWatch` de propósito, enquanto for experimento: se
a visão ficar (ou for para outras mídias), vale extrair o layout comum.
