-- =====================================================================
-- Parte 58 · Ordem de serviço do banco nº1, item S2: as funções security definer saem do esquema exposto pela API.
-- Antes: 51 funções do public rodavam com o poder do dono e podiam ser chamadas por /rest/v1/rpc/<nome> (aviso 0029).
-- Agora: o corpo de cada uma vai para o esquema "logica" (não exposto pela API) e no public fica só uma porta fina,
--        security invoker, com o MESMO nome, os MESMOS parâmetros (nomes e padrões) e a MESMA resposta.
--        A tela e as Edge Functions continuam chamando rpc('<nome>') sem mudar nada.
-- A regra de acesso de cada uma (dono do sistema, nos_editaveis, inv_pode, ...) continua dentro do corpo, em logica.
-- Daqui em diante: mudar uma dessas funções = "create or replace function logica.<nome>" (não public).
--   Se alguém recriar por engano uma security definer no public, rodar esta parte de novo: ela leva a nova para logica.
-- Plano de volta: 58_funcoes_fora_da_api_VOLTA.sql.
-- =====================================================================
create schema if not exists logica;
comment on schema logica is 'Corpo das funções da API que rodam com o poder do dono (security definer). Não é exposto pela API; o public só tem a porta fina (security invoker) de cada uma.';
revoke all on schema logica from public, anon;
grant usage on schema logica to authenticated, service_role;
alter default privileges in schema logica revoke execute on functions from public;

do $$
declare f record; args text; n int; vol text; corpo text;
begin
  for f in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) ident, pg_get_function_arguments(p.oid) argdef,
           pg_get_function_result(p.oid) res, p.pronargs, p.provolatile, p.proretset,
           has_function_privilege('service_role', p.oid, 'EXECUTE') sr
      from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.prosecdef and p.prokind = 'f'
       and has_function_privilege('authenticated', p.oid, 'EXECUTE')
     order by p.proname loop
    -- se já existe uma versão antiga em logica (alguém recriou no public), a nova vence
    execute format('drop function if exists logica.%I(%s)', f.proname, f.ident);
    execute format('alter function public.%I(%s) set schema logica', f.proname, f.ident);
    select string_agg('$' || i, ', ') into args from generate_series(1, f.pronargs) i;
    vol := case f.provolatile when 'i' then 'immutable' when 's' then 'stable' else 'volatile' end;
    corpo := format('select * from logica.%I(%s)', f.proname, coalesce(args, ''));
    execute format('create function public.%I(%s) returns %s language sql %s security invoker set search_path = '''' as %L',
                   f.proname, f.argdef, f.res, vol, corpo);
    execute format('comment on function public.%I(%s) is %L', f.proname, f.ident,
                   'Porta da API (security invoker). O corpo e a regra de acesso estão em logica.' || f.proname || '.');
    execute format('revoke all on function public.%I(%s) from public, anon', f.proname, f.ident);
    execute format('revoke all on function logica.%I(%s) from public, anon', f.proname, f.ident);
    execute format('grant execute on function public.%I(%s) to authenticated', f.proname, f.ident);
    execute format('grant execute on function logica.%I(%s) to authenticated', f.proname, f.ident);
    if f.sr then
      execute format('grant execute on function public.%I(%s) to service_role', f.proname, f.ident);
      execute format('grant execute on function logica.%I(%s) to service_role', f.proname, f.ident);
    end if;
    n := coalesce(n, 0) + 1;
  end loop;
  raise notice 'S2: % funções movidas para logica, com porta fina no public', coalesce(n, 0);
end $$;
