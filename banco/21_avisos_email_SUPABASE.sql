-- =====================================================================
-- Parte 21 (SÓ NO SUPABASE, e só depois de a função enviar-avisos estar no ar):
-- as rotinas que chamam a função para mandar os e-mails.
--
-- Antes de rodar:
--   1. Extensão pg_net ligada (Database > Extensions > pg_net).
--   2. Função enviar-avisos implantada com verify_jwt = false e com os segredos
--      AVISOS_SEGREDO, RESEND_API_KEY e AVISOS_REMETENTE.
--   3. O MESMO valor de AVISOS_SEGREDO guardado no Vault do banco com o nome ciclodev_avisos_segredo:
--        select vault.create_secret('<o valor>', 'ciclodev_avisos_segredo');
--      (o valor nunca fica escrito neste arquivo nem na rotina: ela lê do Vault na hora).
--
-- Horários (em UTC; Brasília é UTC-3):
--   ciclodev_email_imediato  a cada 5 minutos
--   ciclodev_email_diario    todo dia às 8h de Brasília (11h UTC)
--   ciclodev_email_semanal   segunda às 8h05 de Brasília
-- =====================================================================
create or replace function interno.chamar_enviar_avisos(p_modo text) returns bigint
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare segredo text;
begin
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'ciclodev_avisos_segredo';
  if segredo is null then raise notice 'Falta o segredo ciclodev_avisos_segredo no Vault'; return null; end if;
  return net.http_post(
    url := 'https://tfcvoszeewmpghgxztuy.supabase.co/functions/v1/enviar-avisos?modo=' || p_modo,
    headers := jsonb_build_object('x-avisos-segredo', segredo, 'content-type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 55000);
end $$;
revoke all on function interno.chamar_enviar_avisos(text) from public, anon, authenticated;

do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('ciclodev_email_imediato', 'ciclodev_email_diario', 'ciclodev_email_semanal');
  perform cron.schedule('ciclodev_email_imediato', '*/5 * * * *', $c$select interno.chamar_enviar_avisos('imediato')$c$);
  perform cron.schedule('ciclodev_email_diario', '0 11 * * *', $c$select interno.chamar_enviar_avisos('diario')$c$);
  perform cron.schedule('ciclodev_email_semanal', '5 11 * * 1', $c$select interno.chamar_enviar_avisos('semanal')$c$);
end $$;
