-- SOMENTE TESTE LOCAL: parte 72 (sobras de fonte que saiu). Numa transação que volta atrás.
\set ON_ERROR_STOP 1
\pset tuples_only on
begin;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;
create or replace function pg_temp.como(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, true); perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true); end $$;
create temp table fx as select (select id from nos where nome = 'Java BL' and tipo = 'aplicacao') a1, (select auth_user_id from pessoas where nome = 'William') will_auth,
  (select id from nos where pai_id = (select id from nos where nome = 'Java BL' and tipo = 'aplicacao') and tipo = 'frente' limit 1) fr, (select status_id from itens where status_id is not null limit 1) st;
grant select on fx to authenticated;
-- um banco que já saiu (não existe mais em infra_bancos) deixou um épico com três histórias; numa delas alguém comentou
insert into itens (id, frente_id, titulo, tipo, status_id, descricao) select '72000000-0000-0000-0000-000000000001', fr, 'Banco: Fiscal', 'epic', st, 'Épico montado pelo CicloDev a partir do que já existe' from fx;
insert into itens (id, frente_id, titulo, tipo, status_id, pai_id) select ('72000000-0000-0000-0000-00000000000' || n)::uuid, fr, 'Tabela ' || n, 'story', st, '72000000-0000-0000-0000-000000000001' from fx, generate_series(2, 4) n;
insert into comentarios (item_id, texto) values ('72000000-0000-0000-0000-000000000004', 'já estou mexendo nisto');
insert into analise_inventario (no_id, origem, rotulo, tipo, chave, grupo, nome, onde, sinais, item_id) select a1, 'banco:72000000-0000-0000-0000-0000000000aa', 'Banco de produção', 'tabela', 't' || n, 'Banco: Fiscal', 'Tabela ' || n, 'x', '{}',
  case when n <= 4 then ('72000000-0000-0000-0000-00000000000' || n)::uuid end from fx, generate_series(2, 5) n;
-- e uma fonte que continua ligada não aparece como sobra
insert into infra_bancos (id, no_id, nome, provedor, motor, esquemas) select '72000000-0000-0000-0000-0000000000bb', a1, 'Banco ligado', 'outro', 'postgres', '{public}' from fx;
insert into itens (id, frente_id, titulo, tipo, status_id) select '72000000-0000-0000-0000-000000000009', fr, 'Tabela ligada', 'story', st from fx;
insert into analise_inventario (no_id, origem, rotulo, tipo, chave, grupo, nome, onde, sinais, item_id) select a1, 'banco:72000000-0000-0000-0000-0000000000bb', 'Banco ligado', 'tabela', 'tl', 'G', 'Tabela ligada', 'x', '{}', '72000000-0000-0000-0000-000000000009' from fx;

select pg_temp.como((select will_auth from fx));
set local role authenticated;
create temp table s1 as select fonte_sobras((select a1 from fx)) s;
reset role;
-- 1. a lista
select pg_temp.ok((select jsonb_array_length(s) = 1 and s->0->>'origem' = 'banco:72000000-0000-0000-0000-0000000000aa' and s->0->>'nome' = 'Banco de produção' from s1), 'só o banco que saiu aparece como sobra, com o nome');
select pg_temp.ok((select (s->0->>'itens')::int = 4 and (s->0->>'intactos')::int = 2 from s1), 'conta 4 itens (3 histórias e o épico), 2 que ninguém mexeu');
-- 2. fonte ligada é recusada (tem a chave dela)
set local role authenticated;
do $$ begin perform fonte_sobras_lixeira((select a1 from fx), 'banco:72000000-0000-0000-0000-0000000000bb', true); raise notice 'FALHA fonte ligada foi aceita';
exception when invalid_parameter_value then raise notice 'OK    fonte que continua ligada é recusada (usa a chave dela)'; end $$;
reset role;
-- 3. só os intactos
set local role authenticated;
create temp table r3 as select fonte_sobras_lixeira((select a1 from fx), 'banco:72000000-0000-0000-0000-0000000000aa', false) n;
reset role;
select pg_temp.ok((select n = 2 from r3) and (select count(*) = 2 from itens where id in ('72000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000003') and excluido_em is not null),
  'só os que ninguém mexeu vão para a lixeira (2)');
select pg_temp.ok((select excluido_em is null from itens where id = '72000000-0000-0000-0000-000000000004') and (select excluido_em is null from itens where id = '72000000-0000-0000-0000-000000000001'),
  'a história comentada fica, e o épico dela também');
select pg_temp.ok(not exists (select 1 from analise_inventario where origem = 'banco:72000000-0000-0000-0000-0000000000aa' and item_id is null), 'o que não tinha virado item sai do inventário');
select pg_temp.ok((select excluido_em is null from itens where id = '72000000-0000-0000-0000-000000000009'), 'o item da fonte ligada não é tocado');
-- 4. pessoa de fora: não vê a lista e não consegue mandar nada
select gen_random_uuid() as fora \gset
insert into auth.users (id, email, raw_user_meta_data) values (:'fora', 'fora-' || :'fora' || '@t.com', '{"nome":"Fora"}');
select pg_temp.como(:'fora');
set local role authenticated;
select pg_temp.ok(fonte_sobras((select a1 from fx)) = '[]'::jsonb, 'pessoa de fora não vê sobras');
do $$ begin perform fonte_sobras_lixeira((select a1 from fx), 'banco:72000000-0000-0000-0000-0000000000aa', true); raise notice 'FALHA pessoa de fora mandou para a lixeira';
exception when insufficient_privilege then raise notice 'OK    pessoa de fora é recusada'; end $$;
reset role;
select pg_temp.ok((select excluido_em is null from itens where id = '72000000-0000-0000-0000-000000000004'), 'pessoa de fora não manda nada para a lixeira');
-- 5. todos: vai a comentada e o épico junto
select pg_temp.como((select will_auth from fx));
set local role authenticated;
create temp table r5 as select fonte_sobras_lixeira((select a1 from fx), 'banco:72000000-0000-0000-0000-0000000000aa', true) n;
create temp table s5 as select fonte_sobras((select a1 from fx)) s;
reset role;
select pg_temp.ok((select n = 2 from r5) and not exists (select 1 from itens where id::text like '72000000-0000-0000-0000-00000000000_' and id <> '72000000-0000-0000-0000-000000000009' and excluido_em is null),
  'Todos: a história comentada e o épico vão para a lixeira');
select pg_temp.ok((select s = '[]'::jsonb from s5), 'depois disso a sobra some da lista');
select pg_temp.ok((select count(*) = 1 from pg_proc where proname = 'fonte_sobras_lixeira' and pronamespace = 'public'::regnamespace), 'uma só fonte_sobras_lixeira na API');
rollback;
