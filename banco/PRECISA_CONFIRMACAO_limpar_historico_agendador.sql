-- PREPARADO, NÃO APLICADO. Ordem de serviço do banco nº1, item I3. O prazo é decisão do dono (troque 14 pelo prazo decidido).
-- O histórico das rotinas (cron.job_run_details) tinha 15.049 linhas (2,5 MB) em 03/10/2026 e cresce cerca de 2.000 por dia.
select cron.unschedule(jobid) from cron.job where jobname = 'ciclodev_limpar_agendador';
select cron.schedule('ciclodev_limpar_agendador', '29 3 * * *', $$delete from cron.job_run_details where end_time < now() - interval '14 days'$$);
