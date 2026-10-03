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
  for f in 01_*.sql 02_*.sql 03_*.sql 04_*.sql 05_*.sql 06_*.sql 07_*.sql 08_*.sql 09_*.sql 10_*.sql 11_*.sql 12_*.sql 13_*.sql 14_*.sql 15_*.sql 16_*.sql 17_*.sql 18_*.sql 19_*.sql 20_*.sql 22_*.sql 23_*.sql 25_*.sql 26_*.sql 28_*.sql 29_*.sql 30_*.sql 32_*.sql 33_*.sql 34_*.sql 35_*.sql 36_*.sql 37_*.sql 38_*.sql 39_*.sql 40_*.sql 41_*.sql 42_*.sql 43_*.sql 44_*.sql 45_*.sql 46_*.sql 47_*.sql 48_*.sql 50_*.sql 51_*.sql 52_*.sql 53_*.sql 54_*.sql 55_*.sql 56_*.sql 57_segredos_no_vault.sql 58_funcoes_fora_da_api.sql 59_historico_so_insercao_e_execucao.sql 60_onda2_arvore_e_permissoes.sql 61_webhook_repeticao_e_limite.sql 62_onda3_indices_rotinas_politicas_comentarios.sql 63_alerta_visto.sql 64_limpar_desenhos_de_fonte_que_saiu.sql 65_fonte_desenhos_e_itens.sql 66_epico_intacto_com_situacao_automatica.sql 67_ao_vivo.sql; do
    echo; echo "-- >>>>>>>>>> $f"; cat "$f"
  done
} > APLICAR_NO_SUPABASE.sql
echo "APLICAR_NO_SUPABASE.sql pronto"
