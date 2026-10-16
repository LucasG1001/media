#!/usr/bin/env bash
#
# Restaura um dump de produção no Postgres de desenvolvimento (docker-compose.dev.yml).
# Substitui o conteúdo do banco de dev; a produção nunca é escrita.
#
# Uso:
#   scripts/dev-seed.sh <arquivo.dump>        # .dump baixado em Configurações → Backup
#   scripts/dev-seed.sh --from-vps <ssh-host> # puxa um pg_dump fresco da VPS via SSH
#
# O dump traz a tabela image_cache, mas os bytes das capas ficam em disco na VPS:
# o backend de dev rebaixa cada capa na primeira vez que ela for pedida.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE=(docker compose -f "$ROOT/docker-compose.dev.yml")

usage() {
  echo "uso: $(basename "$0") <arquivo.dump> | --from-vps <ssh-host>" >&2
  exit 1
}

[ $# -ge 1 ] || usage

"${COMPOSE[@]}" up -d --wait postgres

# --no-owner/--no-acl: o dono dos objetos na produção vem do .env da VPS e pode não
# existir aqui. Sem -t no exec (TTY corromperia o binário).
restore() {
  "${COMPOSE[@]}" exec -T postgres \
    pg_restore -U media -d media_tracker --clean --if-exists --no-owner --no-acl
}

case "$1" in
  --from-vps)
    [ $# -eq 2 ] || usage
    # As variáveis são expandidas dentro do container de produção, não aqui.
    ssh "$2" "docker exec \$(docker ps -qf name=media-tracker-postgres) sh -c 'pg_dump -Fc -U \"\$POSTGRES_USER\" \"\$POSTGRES_DB\"'" | restore
    ;;
  *)
    [ -f "$1" ] || { echo "Arquivo não encontrado: $1" >&2; exit 1; }
    restore < "$1"
    ;;
esac

echo "Banco de dev restaurado."
