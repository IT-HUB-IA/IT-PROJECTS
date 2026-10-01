#!/bin/sh
# Monta APLICAR_NO_SUPABASE.sql com as partes 01 a 20, 22, 23, 25, 26, 28, 29, 30, 32 a 38, na ordem (a 21, a 24, a 27 e a 31 entram separadas). Rodar sempre que mudar uma parte.
cd "$(dirname "$0")"
python3 gerar_semente.py >/dev/null
{
  echo "-- ====================================================================="
  echo "-- CicloDev · banco completo para o Supabase tfcvoszeewmpghgxztuy"
  echo "-- Rodar UMA VEZ, inteiro, num banco sem estas tabelas (SQL Editor ou migration). Ordem: 01 a 20."
  echo "-- Depois disso, 05, 06, 07, 08, 09 e 10 podem ser rodados de novo sozinhos (recriam funções e regras; a semente não duplica)."
  echo "-- Gerado em $(date +%Y-%m-%d). Os arquivos 00, 90 a 98 são só de teste local e NÃO entram aqui. A parte 21 (e-mail) entra separada, depois da função enviar-avisos; a 24 (webhook do portal), a 27 (arquivos do chat) e a 31 (chamada automática dos desenhos) também."
  echo "-- ====================================================================="
  for f in 01_*.sql 02_*.sql 03_*.sql 04_*.sql 05_*.sql 06_*.sql 07_*.sql 08_*.sql 09_*.sql 10_*.sql 11_*.sql 12_*.sql 13_*.sql 14_*.sql 15_*.sql 16_*.sql 17_*.sql 18_*.sql 19_*.sql 20_*.sql 22_*.sql 23_*.sql 25_*.sql 26_*.sql 28_*.sql 29_*.sql 30_*.sql 32_*.sql 33_*.sql 34_*.sql 35_*.sql 36_*.sql 37_*.sql 38_*.sql 39_*.sql 40_*.sql 41_*.sql 42_*.sql 43_*.sql; do
    echo; echo "-- >>>>>>>>>> $f"; cat "$f"
  done
} > APLICAR_NO_SUPABASE.sql
echo "APLICAR_NO_SUPABASE.sql pronto"
