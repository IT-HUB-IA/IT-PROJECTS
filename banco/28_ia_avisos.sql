-- =====================================================================
-- CicloDev · 28 · Aviso de mensagem nova do DevIT com o chat fechado
--
-- ia_agentes.visto_ate: até quando a pessoa já viu a conversa (abrindo o chat). Mensagem do DevIT depois disso
-- é novidade: o balão se mexe e pulsa até a pessoa abrir o chat.
--   ia_novidades()    quantas mensagens do DevIT a pessoa ainda não viu
--   ia_marcar_visto() a pessoa abriu o chat: tudo até agora fica visto
-- Depende da parte 26.
-- =====================================================================
alter table public.ia_agentes add column if not exists visto_ate timestamptz;
comment on column public.ia_agentes.visto_ate is 'Até quando a pessoa já viu a conversa com o DevIT (abriu o chat). Mensagem do DevIT depois disso aparece como aviso no balão.';

create or replace function public.ia_novidades() returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int from public.ia_mensagens m
   where m.pessoa_id = interno.pessoa_atual() and m.autor = 'agente'
     and m.criado_em > coalesce((select a.visto_ate from public.ia_agentes a where a.pessoa_id = interno.pessoa_atual()), '-infinity'::timestamptz)
$$;

create or replace function public.ia_marcar_visto() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual();
begin
  if eu is null then raise exception 'Entre no sistema primeiro' using errcode = '42501'; end if;
  perform interno.ia_preparar(eu);
  update public.ia_agentes set visto_ate = now() where pessoa_id = eu;
end $$;

revoke all on function public.ia_novidades(), public.ia_marcar_visto() from public, anon;
grant execute on function public.ia_novidades(), public.ia_marcar_visto() to authenticated;
