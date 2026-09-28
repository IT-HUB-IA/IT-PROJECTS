#!/bin/sh
# Monta APLICAR_NO_SUPABASE.sql com as partes 01 a 10, na ordem. Rodar sempre que mudar uma parte.
cd "$(dirname "$0")"
python3 gerar_semente.py >/dev/null
{
  echo "-- ====================================================================="
  echo "-- Sistema IT.IA · banco completo para o Supabase tfcvoszeewmpghgxztuy"
  echo "-- Rodar UMA VEZ, inteiro, num banco sem estas tabelas (SQL Editor ou migration). Ordem: 01 a 10."
  echo "-- Depois disso, 05, 06, 07, 08, 09 e 10 podem ser rodados de novo sozinhos (recriam funções e regras; a semente não duplica)."
  echo "-- Gerado em $(date +%Y-%m-%d). Os arquivos 00, 90, 91 e 92 são só de teste local e NÃO entram aqui."
  echo "-- ====================================================================="
  for f in 01_*.sql 02_*.sql 03_*.sql 04_*.sql 05_*.sql 06_*.sql 07_*.sql 08_*.sql 09_*.sql 10_*.sql; do
    echo; echo "-- >>>>>>>>>> $f"; cat "$f"
  done
} > APLICAR_NO_SUPABASE.sql
echo "APLICAR_NO_SUPABASE.sql pronto"
