# Backup — Notas de Implementação (o que foi feito e por quê)

> Este documento é o **registro/raciocínio** por trás do sistema de backup.
> Para o **passo a passo operacional** (rclone, cron, restore), veja [`BACKUP.md`](./BACKUP.md).

## 1. Objetivo

Projeto pessoal, sem auth, dados que não quero perder (anime, filmes, séries,
jogos, livros). Quero o backup salvo no **Google Drive** (offsite) e podendo ir
pro **HD** quando eu quiser. O botão de backup que existia "não funcionava"
(gerava um HTML em vez do arquivo).

## 2. Diagnóstico do bug original ("gerava HTML")

O botão **Exportar** baixava o `index.html` do app em vez do JSON.

**Causa:** o frontend chamava `/backup/export` **sem o prefixo `/api`**. Todos os
outros serviços usam `/api/...` (ex.: `/api/library`). Sem o `/api`, o nginx/Caddy
não reconhece como rota de API e cai no **fallback do SPA**, devolvendo o
`index.html`. Por isso vinha aquele `<!doctype html>...`.

**Correção:** `/backup/export` → `/api/backup/export` e
`/backup/import` → `/api/backup/import` no `SettingsPage.tsx`.

> Lição: num SPA com proxy, requisição que "volta HTML" quase sempre é rota que
> não bateu no backend e caiu no `index.html`.

## 3. Decisão: dois formatos (JSON **e** `.dump`)

| | **JSON** | **`.dump`** (pg_dump custom) |
|---|---|---|
| Restaura | pelo próprio app (merge, não apaga) | `pg_restore` no terminal |
| Portabilidade | altíssima (lê em qualquer lugar) | amarrado ao Postgres (~v16) |
| Fidelidade | só os dados das libraries | banco inteiro, fiel |
| Uso | dia a dia / restore fácil | desastre total / recriar do zero |

São **complementares**: JSON pro conforto, `.dump` pra segurança máxima. Por isso
geramos os dois.

## 4. Arquitetura: 3 camadas

```
Camada 1 — App, botão "Exportar JSON"   → download manual, restaura no app
Camada 2 — App, botão "Baixar .dump"    → download manual, restore via pg_restore
Camada 3 — Cron no VPS (diário)         → .dump + JSON → Google Drive (rclone)
```

A **camada 3 é a rede de segurança real**: roda sozinha às 3h, independente de eu
abrir o app. As camadas 1 e 2 são pra quando eu quiser puxar algo na hora.

## 5. O que foi construído

### Backend
- **`controllers/backupController.ts`** — `exportDump`: roda `pg_dump -Fc` via
  `child_process.spawn` e faz *stream* da saída pro response (download binário).
  `exportAll` (JSON) e `importAll` (merge) já existiam.
- **`routes/backupRoutes.ts`** — nova rota `GET /api/backup/export/dump`.
- **`backend/Dockerfile`** — `apk add --no-cache postgresql16-client` na imagem de
  runtime. Sem isso o backend (node:alpine) não tem o `pg_dump` e o botão falha.

### Frontend
- **`SettingsPage.tsx`** — corrige o prefixo `/api` (bug do HTML) e adiciona o
  botão **"Baixar .dump"** (download via `responseType: "blob"`).

### Infra de backup automático
- **`scripts/backup-to-gdrive.sh`** — gera `.dump` + JSON, envia pro Drive via
  `rclone`, rotaciona (30 dias, local e remoto).
- **`BACKUP.md`** — guia operacional (rclone, cron, restore).

## 6. Por que `rclone` (e não a API do Google direto)

`rclone` é o "rsync da nuvem". Codar a API do Drive no backend exigiria gerenciar
OAuth, refresh de token e erros de upload **dentro do código**. O `rclone` já
resolve tudo isso, é o padrão pra backup caseiro, e a autenticação fica **fora do
código** (no config dele). Instala-se **uma vez no VPS** e serve pra todos os
projetos.

### A pegadinha do OAuth (importante!)
Conta Gmail → tipo de usuário **Externo**. Nesse modo o app nasce em **"Testing"**,
e nesse estado: (a) só "usuários de teste" conseguem logar (senão dá
`403 access_denied`), e (b) o **token expira a cada 7 dias** — o backup pararia
silenciosamente depois de uma semana. **Solução para os dois:** publicar o app
(*Testing → In production*) na tela de consentimento. Não precisa enviar para
verificação; o aviso "app não verificado" se contorna em *Avançado → Acessar*.

### Decisões de segurança adotadas
1. **Conta Google dedicada só para backups.** O Drive de backups fica isolado da
   conta pessoal — mesmo num comprometimento, o conteúdo pessoal não é exposto.
2. **Escopo `drive.file`** (opção `3` no rclone), não `drive` (acesso total).
   O rclone só enxerga/mexe nos arquivos que **ele mesmo cria**. Se o token vazar
   do VPS, o atacante alcança só a pasta de backups — não o resto do Drive.
   Princípio do menor privilégio. (Funciona porque, no backup, o rclone cria tudo:
   pasta e arquivos; ele tem acesso a tudo que precisa, inclusive para rotacionar.)
   Efeito colateral esperado: `rclone lsd gdrive:` não lista o que não foi criado
   pelo rclone — normal.

## 7. Bugs encontrados durante o setup (e a correção)

Três armadilhas clássicas de "shell + docker + binário". Ficam registradas porque
vão aparecer de novo em outros projetos:

1. **`/api` faltando** → SPA devolvia `index.html`. (ver seção 2)

2. **`docker exec -t` corrompe binário.** O `-t` aloca um TTY, que converte `\n`
   em `\r\n`. Num `.dump` (binário) isso **corrompe o arquivo**. Correção: nada de
   `-t` quando a saída é binária e vai pra um arquivo.

3. **`source` de um `.env` docker quebra com `set -u`.** O `.env` do compose é
   formato `CHAVE=valor`, **não** um script shell. Ao dar `source` nele com
   `set -euo pipefail`, qualquer valor com `$` (ex.: uma senha contendo `$ps...`)
   é interpretado pelo bash como variável e dispara *"unbound variable"*.
   **Correção (melhor que consertar o parsing):** não ler o `.env`. O container do
   Postgres **já tem** `POSTGRES_USER`/`POSTGRES_DB` no ambiente dele, então
   rodamos `docker exec ... sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"'` —
   o container expande as próprias variáveis. Bônus: a senha nunca passa pelo host.

## 8. Validação feita

- **JSON:** parse OK, estrutura correta (`version`, `exportedAt` + 5 coleções),
  contagens reais (anime 17, movies 12, games 113, books 24), round-trip seguro
  (campos em `camelCase` que o `importAll` relê).
- **`.dump`:** `pg_restore -l` mostrou `Format: CUSTOM`, `TOC Entries: 27`,
  `Dumped from database version: 16.14` → íntegro e restaurável.
- **rclone → Drive:** upload confirmado na conta dedicada (escopo `drive.file`).
- **Cron:** disparo automático no horário agendado confirmado (não só o script na
  mão) — `cron-test.log` registrou `Backup concluído`.
- **Script genérico:** `backup-generic.sh media-tracker` validado em produção; é o
  que está no cron atual (substituiu o `backup-to-gdrive.sh`).

## 9. Restaurar (resumo — detalhes no BACKUP.md)

- **JSON:** app → Configurações → Backup → Importar.
- **`.dump`:**
  ```bash
  PG=$(docker ps -qf name=media-tracker-postgres)
  cat backup.dump | docker exec -i "$PG" pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists
  ```

## 10. O que é único vs. o que repete (pra próximos projetos)

**Feito uma vez, nunca mais:** instalar rclone no VPS, criar o OAuth/Client ID no
Google Cloud, publicar o app em produção, configurar o remote `gdrive:` (conta
dedicada, escopo `drive.file`), instalar o `backup-generic.sh` em
`/home/lucas/scripts/`.

**Por projeto (rápido):** com o script genérico adotado, é **1 linha no cron**
(veja §11). A modificação no Dockerfile (`postgresql16-client`) só é necessária se
você quiser o botão de download dentro daquele app — para o backup automático não
precisa, pois o `pg_dump` roda dentro do container do Postgres.

## 11. Versão genérica (zero edição): `scripts/backup-generic.sh`

Um único script reutilizável que recebe o **nome do projeto** como argumento e
deriva o resto (containers, pasta no Drive, pasta local). Para os próximos
projetos não se edita nada — só se troca o argumento.

```bash
backup-generic.sh media-tracker
backup-generic.sh done
```

Convenções derivadas (todas sobrescrevíveis por variável de ambiente):

| Item | Padrão | Override |
|---|---|---|
| Container do Postgres | `<projeto>-postgres-N` | `POSTGRES_SERVICE` |
| Pasta no Drive | `gdrive:<projeto>-backups` | `RCLONE_REMOTE` |
| Pasta local | `/home/lucas/backups/<projeto>` | `BACKUP_DIR` |
| Retenção | 30 dias | `RETENTION_DAYS` |

O `.dump` é universal (sempre roda). O **JSON é opcional**: só roda se o projeto
tiver a rota de export e você definir `SERVER_SERVICE`:

```bash
SERVER_SERVICE=server backup-generic.sh media-tracker
```

Cron com vários projetos (um por linha):

```cron
0 3 * * * SERVER_SERVICE=server /home/lucas/scripts/backup-generic.sh media-tracker >> /home/lucas/backups/media-tracker.log 2>&1
0 4 * * * /home/lucas/scripts/backup-generic.sh done >> /home/lucas/backups/done.log 2>&1
```

**Onde guardar:** como ele serve a vários repos, o lugar natural é fora deste
projeto (ex.: `/home/lucas/scripts/`). A cópia que está aqui em `scripts/` é só a
"fonte" versionada — copie-a para lá no VPS:

```bash
mkdir -p /home/lucas/scripts
cp /home/lucas/stash/scripts/backup-generic.sh /home/lucas/scripts/
chmod +x /home/lucas/scripts/backup-generic.sh
```

> **Status atual:** o media-tracker já usa o `backup-generic.sh` no cron (migrado).
> O `backup-to-gdrive.sh` (versão específica original) permanece no repositório
> apenas como referência histórica — não está mais em uso.

## O que fica de fora do export JSON

O `GET /api/backup/export` monta o JSON a partir de listas explícitas de colunas em
`backupController`, e a regra geral é que **coluna nova de biblioteca entra nessas listas** — senão
se perde no round-trip. Duas coisas ficam fora de propósito:

- **`detail_cache` / `detail_cached_at`** (as cinco mídias com catálogo) — é a última resposta de
  detalhe da API externa, guardada para o drawer abrir offline. Medido: ~4 KB por anime, ~2 KB por
  jogo, ~1,7 KB por série, ~1 KB por filme; com a biblioteca toda cacheada dá ~4 MB só de cache num
  export que hoje é de algumas centenas de KB — perto do `limit: "10mb"` do `express.json` que o
  import atravessa. E é re-derivável: o `GET /api/<mídia>/:id` e o job `backfillDetailCache`
  reconstroem sozinhos depois de um import.
- **O cache de capas** — os bytes vivem no volume `image_cache` (`/data/images`), não no banco. A
  tabela `image_cache` guarda só o metadado e também não é exportada; o job `warmupImages` baixa de novo
  tudo em alguns ticks. **Consequência prática:** um restore que não traga o volume deixa o app sem
  imagens offline até o warm-up drenar.

O **dump do PostgreSQL** (`GET /api/backup/export/dump`, `pg_dump -Fc`) traz as duas tabelas
inteiras, `detail_cache` incluído — a exclusão vale só para o export JSON.
