-- =====================================================================
-- Parte 31 (SÓ NO SUPABASE, depois da parte 30 e com a função diagramas-auto publicada, verify_jwt desligado):
-- o banco chama a função diagramas-auto sozinho.
--   * a cada publicação em produção (gatilho da parte 30), "Atualizar agora" e banco ligado ou trocado;
--   * a cada 10 minutos, se houver pedido parado ou banco para ler (lido de hora em hora).
--
-- O segredo entre o banco e a função é criado aqui mesmo, no Vault, com um valor aleatório: ninguém precisa ver,
-- copiar ou colar. A função confere o segredo chamando infra_auto_confere (só o papel service_role chama).
-- Precisa das extensões pg_net e pg_cron (as mesmas das partes 21 e 24).
-- =====================================================================
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'ciclodev_diagramas_segredo') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'ciclodev_diagramas_segredo', 'Segredo entre o banco e a função diagramas-auto');
  end if;
end $$;

create or replace function public.infra_auto_confere(p_segredo text) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'ciclodev_diagramas_segredo';
  return s is not null and length(coalesce(p_segredo, '')) >= 32 and p_segredo = s;
end $$;
revoke all on function public.infra_auto_confere(text) from public, anon, authenticated;
grant execute on function public.infra_auto_confere(text) to service_role;

-- a chamada (pg_net manda depois que a transação termina; não segura quem publicou)
create or replace function interno.infra_auto_chamar() returns bigint
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'ciclodev_diagramas_segredo';
  if s is null then raise notice 'Falta o segredo ciclodev_diagramas_segredo no Vault'; return null; end if;
  return net.http_post(
    url := 'https://tfcvoszeewmpghgxztuy.supabase.co/functions/v1/diagramas-auto',
    headers := jsonb_build_object('x-diagramas-segredo', s, 'content-type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 10000);
end $$;
revoke all on function interno.infra_auto_chamar() from public, anon, authenticated;

-- a rotina: só chama quando há o que fazer
create or replace function interno.infra_auto_rotina() returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from public.infra_automacoes where status = 'pendente' or (status = 'rodando' and iniciado_em < now() - interval '15 minutes'))
     or exists (select 1 from public.infra_bancos where ativo and (ultima_leitura_em is null or ultima_leitura_em < now() - interval '55 minutes')) then
    return interno.infra_auto_chamar();
  end if;
  return null;
end $$;
revoke all on function interno.infra_auto_rotina() from public, anon, authenticated;

do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'ciclodev_diagramas_auto';
  perform cron.schedule('ciclodev_diagramas_auto', '*/10 * * * *', $c$select interno.infra_auto_rotina()$c$);
end $$;
