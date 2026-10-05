#!/bin/sh
# Instala (ou atualiza) o trabalhador do Mapa do Sistema num servidor com Docker. Rodar dentro desta pasta (worker/mapa):
#   sh instalar.sh
# Na primeira vez ele pede o endereço da função e o segredo (guardados em /etc/ciclodev-mapa.env, só o root lê).
# O segredo está no Cofre do CicloDev, item "Trabalhador do Mapa do Sistema". Ele nunca aparece na tela nem no histórico do terminal.
set -e
ARQ=/etc/ciclodev-mapa.env
if [ ! -f "$ARQ" ]; then
  printf 'Endereço da função (ex.: https://<projeto>.supabase.co/functions/v1/mapa-trabalho): '; read -r URL
  printf 'Segredo do trabalhador (não aparece enquanto digita): '; stty -echo; read -r SEG; stty echo; echo
  umask 077; printf 'MAPA_URL=%s\nMAPA_SEGREDO=%s\n' "$URL" "$SEG" > "$ARQ"; chmod 600 "$ARQ"
fi
docker build -t ciclodev-mapa .
docker rm -f ciclodev-mapa >/dev/null 2>&1 || true
# limites: 4 GB de memória, 2 processadores, no máximo 2048 processos; reinicia sozinho se cair ou o servidor reiniciar
docker run -d --name ciclodev-mapa --restart unless-stopped --env-file "$ARQ" \
  --memory 4g --cpus 2 --pids-limit 2048 --security-opt no-new-privileges --cap-drop ALL --cap-add SETUID --cap-add SETGID --cap-add CHOWN --cap-add DAC_OVERRIDE --cap-add FOWNER \
  ciclodev-mapa
echo "Pronto. Para ver o que ele está fazendo: docker logs -f ciclodev-mapa"
