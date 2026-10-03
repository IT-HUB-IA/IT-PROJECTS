#!/bin/sh
# Suíte de testes do banco do CicloDev num comando só (ordem de serviço nº1, O5).
# Precisa de um Postgres local (16 ou 17) com o pgcrypto. Uso: PGHOST=/tmp PGPORT=55432 PGUSER=postgres sh banco/testar.sh
# Monta um banco limpo com todas as partes (como no Supabase, sem as _SUPABASE) e roda cada teste numa cópia limpa.
# Saída: uma linha por teste (OK, FALHA, ERRO) e o total. Sai com código 1 se algum teste novo (99_*) tiver FALHA ou ERRO.
cd "$(dirname "$0")"
P="psql -q -v ON_ERROR_STOP=1"
# ao montar, só avisos e erros; nos testes, os NOTICE contam (alguns OK saem como NOTICE)
M="env PGOPTIONS=-cclient_min_messages=warning psql -q -v ON_ERROR_STOP=1"
BASE=ciclodev_teste_base
$P -d postgres -c "drop database if exists $BASE" -c "create database $BASE" >/dev/null || exit 1
$P -d $BASE -c "create schema if not exists extensions; create extension if not exists pgcrypto schema extensions" >/dev/null
for f in 00 01 02 03 04 05 06 07 08 91 11 12 13 14 15 16 17 18 19 20 22 23 25 26 28 29 30 32 33 34 35 36 37 38 39 40 41 42 43 44 45 46 47 48 50 51 52 53 54 55 56 57 58 59 60 61 62; do
  arq=$(ls ${f}_*.sql | grep -v -e _VOLTA -e PRECISA | head -1)
  $M -d $BASE -f "$arq" >/dev/null 2>&1 || { echo "ERRO ao montar a parte $f ($arq)"; exit 1; }
done
psql -q -d $BASE -f 91_usuarios_teste_LOCAL.sql >/dev/null 2>&1
ruim=0; tok=0; tfa=0
for t in $(ls | grep -E '^9[3-9]_.*_LOCAL\.sql$'); do
  psql -q -d postgres -c "drop database if exists ciclodev_teste_um" -c "create database ciclodev_teste_um template $BASE" >/dev/null 2>&1
  saida=$(psql -q -d ciclodev_teste_um -f $t 2>&1)
  ok=$(echo "$saida" | grep -c 'OK ') ; fa=$(echo "$saida" | grep -c 'FALHA') ; er=$(echo "$saida" | grep -c 'ERROR')
  tok=$((tok + ok)); tfa=$((tfa + fa))
  printf '%-34s OK=%-4s FALHA=%-3s ERRO=%s\n' "${t%_LOCAL.sql}" "$ok" "$fa" "$er"
  case $t in 99_teste_segredos*|99_teste_rpc_fora*|99_teste_historico*|99_teste_arvore*|99_teste_webhook*|99_teste_politicas*) [ "$fa" -gt 0 ] || [ "$er" -gt 0 ] && ruim=1 ;; esac
done
psql -q -d postgres -c "drop database if exists ciclodev_teste_um" >/dev/null 2>&1
echo "TOTAL: OK=$tok FALHA=$tfa"
exit $ruim
