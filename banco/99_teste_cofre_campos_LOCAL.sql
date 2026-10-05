-- SOMENTE TESTE LOCAL: parte 71 (cofre_campos: os nomes dos campos preenchidos, nunca os valores). Numa transação que volta atrás.
\set ON_ERROR_STOP 1
\pset tuples_only on
begin;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;
create or replace function pg_temp.como(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, true); perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true); end $$;
create or replace function pg_temp.valor(auth uuid, sql text) returns text language plpgsql as $$
declare r text;
begin perform pg_temp.como(auth); execute 'set local role authenticated'; execute sql into r; execute 'reset role'; return r; end $$;
create or replace function pg_temp.erro(auth uuid, sql text) returns text language plpgsql as $$
begin perform pg_temp.como(auth); execute 'set local role authenticated';
  begin execute sql; exception when others then execute 'reset role'; return sqlerrm; end; execute 'reset role'; return 'sem erro'; end $$;
create temp table fx as select (select auth_user_id from pessoas where nome = 'William') w, (select auth_user_id from pessoas where nome = 'Ana (exemplo)') a;
grant select on fx to authenticated;
create temp table it (id uuid); grant select on it to authenticated;
insert into it select pg_temp.valor((select w from fx), $q$select public.cofre_criar('{"tipo":"chave_api","nome":"API Meta"}', '{"chave":"EAAG-segredo-1","segredo":"","notas":"   ","extras":[{"nome":"Token","valor":"tok-999"},{"nome":"","valor":"x"}]}')::text$q$)::uuid;
create temp table r1 as select pg_temp.valor((select w from fx), 'select public.cofre_campos(''' || (select id from it) || ''')::text')::jsonb r;
select pg_temp.ok((select r -> 'campos' = '["chave"]' and r -> 'extras' = '["Token", "Campo extra"]' from r1),
  'devolve só os campos preenchidos (chave; segredo e notas vazios ficam de fora) e os nomes dos campos a mais, na ordem: ' || (select r::text from r1));
select pg_temp.ok((select r::text not like '%EAAG-segredo-1%' and r::text not like '%tok-999%' from r1), 'nenhum valor sai, só os nomes');
select pg_temp.ok(not exists (select 1 from cofre_registros where item_id = (select id from it) and acao = 'revelou'), 'não conta como revelar (nada vai para o histórico)');
select pg_temp.ok(pg_temp.erro((select a from fx), 'select public.cofre_campos(''' || (select id from it) || ''')') like '%não encontrado%', 'quem não tem acesso ao item não vê nem os nomes');
select pg_temp.ok(pg_temp.erro(null, 'select public.cofre_campos(''' || (select id from it) || ''')') <> 'sem erro', 'sem login, nada');
select pg_temp.ok(not has_function_privilege('anon', 'public.cofre_campos(uuid)', 'execute') and not has_function_privilege('service_role', 'logica.cofre_campos(uuid)', 'execute'), 'anon não chama; o service_role não chama a lógica');
rollback;
