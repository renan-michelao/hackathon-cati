#!/usr/bin/env bash
# Sobe o sistema inteiro com um único comando (Bônus 7.2: "todo o ambiente sobe com um único comando").
#
#   ./rodar.sh            sobe tudo (build), espera ficar pronto, cria os dados de demo e mostra o endereço
#   ./rodar.sh parar      para os contêineres (banco e fotos continuam guardados)
#   ./rodar.sh logs       acompanha os logs da API e do worker
#   ./rodar.sh status     mostra o que está rodando
#   ./rodar.sh emails     mostra a caixa de saída simulada (ex.: link de "esqueci minha senha")
#   ./rodar.sh verificar  roda os scripts de verificação contra o sistema no ar (precisa de Node.js)
#   ./rodar.sh verificar-queda  derruba API e worker no meio de leilões e confere se tudo volta
#
# Funciona igual no computador e na VM. Pré-requisito: Docker com o plugin Compose.
set -euo pipefail
cd "$(dirname "$0")"

URL="http://localhost:8080"
VERDE=$'\e[32m'; AMARELO=$'\e[33m'; VERMELHO=$'\e[31m'; NEGRITO=$'\e[1m'; FIM=$'\e[0m'
info() { echo "${NEGRITO}▶${FIM} $*"; }
ok()   { echo "${VERDE}✔${FIM} $*"; }
aviso(){ echo "${AMARELO}!${FIM} $*"; }
erro() { echo "${VERMELHO}✘ $*${FIM}" >&2; exit 1; }

# --- Docker: usa sudo só se o usuário ainda não estiver no grupo docker ---
command -v docker >/dev/null || erro "Docker não encontrado. No Fedora: bash scripts/instalar-docker-fedora.sh"
DOCKER=(docker)
if ! ERRO_DOCKER=$(docker info 2>&1 >/dev/null); then
  if grep -qi "permission denied" <<<"$ERRO_DOCKER"; then
    if sudo docker info >/dev/null 2>&1; then
      DOCKER=(sudo docker)
      aviso "Usando sudo para o Docker (faça logout/login para entrar no grupo docker e dispensar o sudo)."
    else
      erro "Sem permissão para usar o Docker. Rode 'newgrp docker' (ou faça logout/login) e tente de novo."
    fi
  else
    erro "O Docker não está respondendo. Inicie com: sudo systemctl start docker"
  fi
fi
"${DOCKER[@]}" compose version >/dev/null 2>&1 || erro "Plugin Docker Compose não encontrado."
compose() { "${DOCKER[@]}" compose "$@"; }

case "${1:-subir}" in
  parar)  compose down; ok "Parado. Banco e fotos continuam nos volumes."; exit 0 ;;
  logs)   exec "${DOCKER[@]}" compose logs -f api worker ;;
  status) compose ps; exit 0 ;;
  emails)
    # caixa de saída simulada (D41): os 5 e-mails mais recentes, como "esqueci minha senha"
    compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off -x -c "SELECT created_at AS enviado_em, to_email AS para, subject AS assunto, body AS mensagem FROM email_outbox ORDER BY created_at DESC LIMIT 5"'
    exit 0 ;;
  verificar)
    command -v npx >/dev/null || erro "Node.js não encontrado (necessário só para os scripts de verificação)."
    cd api
    [ -d node_modules ] || npm install --silent
    BASE_URL="$URL" npx tsx scripts/verificar.ts
    BASE_URL="$URL" npx tsx scripts/verificar-nivel2.ts
    exit 0 ;;
  verificar-queda)
    # derruba API e worker no meio de leilões e confere se tudo volta (leva ~3 min)
    command -v npx >/dev/null || erro "Node.js não encontrado (necessário só para os scripts de verificação)."
    cd api
    [ -d node_modules ] || npm install --silent
    COMPOSE_CMD="${DOCKER[*]} compose" BASE_URL="$URL" npx tsx scripts/verificar-queda.ts
    exit 0 ;;
  subir) ;;
  *) erro "Comando desconhecido: $1 (use: subir, parar, logs, status, emails, verificar, verificar-queda)" ;;
esac

# --- .env: criado na primeira vez, com senha aleatória para o banco ---
if [ ! -f .env ]; then
  PROJETO=$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_-')   # nome que o Compose dá ao projeto
  if "${DOCKER[@]}" volume ls -q | grep -qx "${PROJETO}_pgdata"; then
    erro "Existe um banco de uma execução anterior, mas não há .env com a senha dele. Restaure o .env ou apague o volume (docker compose down -v)."
  fi
  SENHA=$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')
  sed "s/troque-esta-senha/$SENHA/g" .env.example > .env
  chmod 600 .env
  ok "Criei o .env com uma senha aleatória para o banco."
fi

# --- sobe tudo ---
info "Construindo e subindo os contêineres (a primeira vez demora alguns minutos)..."
compose up -d --build

info "Esperando o sistema responder em $URL ..."
for i in $(seq 1 90); do
  if curl -fsS "$URL/api/health" >/dev/null 2>&1; then break; fi
  [ "$i" -eq 90 ] && { compose ps; erro "O sistema não respondeu em 3 minutos. Veja os logs: ./rodar.sh logs"; }
  sleep 2
done
ok "Sistema no ar."

# --- dados de demonstração (não duplica se já existirem) ---
info "Conferindo os dados de demonstração..."
compose exec -T api node dist/seed.js | sed 's/^/   /'

echo
echo "${VERDE}${NEGRITO}Pronto!${FIM} Acesse ${NEGRITO}$URL${FIM}"
echo "   Contas de demonstração (senha demo1234): ana@demo.com (comitente), bruno@, carla@, diego@demo.com"
echo "   Parar: ./rodar.sh parar   ·   Logs: ./rodar.sh logs   ·   Verificar: ./rodar.sh verificar"
