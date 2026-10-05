#!/bin/sh
# Instala o trabalhador do Mapa do Sistema num servidor Ubuntu. Uso (uma linha só, no terminal do servidor):
#   curl -fsSL https://ciclodev.it-ia.tec.br/mapa/instalar.sh | sh
# Pede só o segredo (está no Cofre do CicloDev, item "Trabalhador do Mapa do Sistema").
set -e
echo ""
echo "=== Instalando o trabalhador do Mapa do Sistema (CicloDev) ==="
URL=https://tfcvoszeewmpghgxztuy.supabase.co/functions/v1/mapa-trabalho
ARQ=/etc/ciclodev-mapa.env
if [ ! -f "$ARQ" ]; then
  echo ""
  echo "Cole o segredo do Cofre (item 'Trabalhador do Mapa do Sistema', campo MAPA_SEGREDO) e aperte Enter."
  echo "(Ele não aparece na tela enquanto você cola. Isso é normal.)"
  stty -echo < /dev/tty; read -r SEG < /dev/tty; stty echo < /dev/tty; echo ""
  if [ ${#SEG} -lt 32 ]; then echo "O segredo parece incompleto. Copie de novo do Cofre e rode o comando outra vez."; exit 1; fi
  CODIGO=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$URL" -H "x-mapa-segredo: $SEG" -H 'content-type: application/json' -d '{"acao":"conferir"}')
  if [ "$CODIGO" = "401" ]; then echo "O CicloDev não aceitou esse segredo. Copie de novo do Cofre e rode o comando outra vez."; exit 1; fi
  umask 077; printf 'MAPA_URL=%s\nMAPA_SEGREDO=%s\n' "$URL" "$SEG" > "$ARQ"; chmod 600 "$ARQ"
  echo "Segredo conferido e guardado."
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "Instalando o Docker (alguns minutos)..."
  apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io >/dev/null
  systemctl enable --now docker >/dev/null 2>&1 || true
fi
PASTA=/opt/ciclodev-mapa
rm -rf "$PASTA"; mkdir -p "$PASTA"
echo "__PACOTE__" | base64 -d | tar -xz -C "$PASTA"
echo "Montando o trabalhador (na primeira vez demora uns 5 minutos)..."
cd "$PASTA" && docker build -q -t ciclodev-mapa . >/dev/null
docker rm -f ciclodev-mapa >/dev/null 2>&1 || true
docker run -d --name ciclodev-mapa --restart unless-stopped --env-file "$ARQ" \
  --memory 4g --cpus 2 --pids-limit 2048 --security-opt no-new-privileges \
  ciclodev-mapa >/dev/null
sleep 5
if docker ps --filter name=ciclodev-mapa --filter status=running -q | grep -q .; then
  echo ""
  echo "=== PRONTO. O trabalhador está ligado e liga sozinho se o servidor reiniciar. ==="
  echo "Pode fechar esta janela."
else
  echo "Algo deu errado ao ligar. Mande uma foto desta tela para o Claude."; docker logs ciclodev-mapa 2>&1 | tail -20
fi
