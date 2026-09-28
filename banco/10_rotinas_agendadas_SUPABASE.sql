-- =====================================================================
-- Sistema IT.IA · 10 · Rotinas agendadas (pg_cron). SÓ NO SUPABASE.
-- Horários em UTC (Brasília = UTC − 3).
-- =====================================================================
create extension if not exists pg_cron;

-- tira os agendamentos antigos com o mesmo nome antes de criar (pode rodar de novo)
select cron.unschedule(jobid) from cron.job where jobname in ('itia_bi_atualizar', 'itia_prazo_vencido');

-- atualiza o ritmo semanal (visão materializada) a cada 10 minutos, sem travar a leitura
select cron.schedule('itia_bi_atualizar', '*/10 * * * *', $$select bi.atualizar()$$);

-- todo dia às 08:07 de Brasília: dispara as automações de "prazo vencido"
select cron.schedule('itia_prazo_vencido', '7 11 * * *', $$select interno.automacoes_prazo_vencido()$$);
