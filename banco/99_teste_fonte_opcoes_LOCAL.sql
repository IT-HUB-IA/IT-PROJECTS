-- SOMENTE TESTE LOCAL: parte 65 (as duas chaves de cada fonte: desenhos / épicos e histórias). Numa transação que volta atrás.
\set ON_ERROR_STOP 1
\pset tuples_only on
begin;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;
create or replace function pg_temp.como(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, true); perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true); end $$;
create temp table fx as select (select id from nos where nome = 'Java BL' and tipo = 'aplicacao') a1, (select auth_user_id from pessoas where nome = 'William') will_auth,
  (select id from nos where pai_id = (select id from nos where nome = 'Java BL' and tipo = 'aplicacao') and tipo = 'frente' limit 1) fr, (select status_id from itens where status_id is not null limit 1) st;
grant select on fx to authenticated;
insert into repositorios (id, no_id, provedor, nome) select '33333333-0000-0000-0000-000000000003', a1, 'github', 'dono/repo' from fx;
insert into infra_diagramas (no_id, aba, nome, formato, origem, chave_auto) select a1, 'software', 'Software · dono/repo', 'plantuml', 'github', 'github:dono/repo:software' from fx;
select interno.infra_quadro_gravar((select a1 from fx), 'software', 'github:dono/repo:software', 'Software · dono/repo', '{"nodes":[{"id":"n1"}],"edges":[]}', (select id from infra_diagramas where chave_auto = 'github:dono/repo:software'), 'robô');
-- o que o robô montou: um épico com duas histórias; numa delas alguém comentou
insert into itens (id, frente_id, titulo, tipo, status_id, descricao) select '44444444-0000-0000-0000-000000000001', fr, 'Épico do robô', 'epic', st, 'Épico montado pelo CicloDev a partir do que já existe' from fx;
insert into itens (id, frente_id, titulo, tipo, status_id, pai_id) select '44444444-0000-0000-0000-000000000002', fr, 'GET /a', 'story', st, '44444444-0000-0000-0000-000000000001' from fx;
insert into itens (id, frente_id, titulo, tipo, status_id, pai_id) select '44444444-0000-0000-0000-000000000003', fr, 'GET /b', 'story', st, '44444444-0000-0000-0000-000000000001' from fx;
insert into comentarios (item_id, texto) values ('44444444-0000-0000-0000-000000000003', 'já estou mexendo nisto');
insert into analise_inventario (no_id, origem, rotulo, tipo, chave, grupo, nome, onde, sinais, item_id) select a1, 'repo:33333333-0000-0000-0000-000000000003', 'dono/repo', 'api', k, 'Épico do robô', n, 'x', '{}', i
  from fx, (values ('api:a', 'GET /a', '44444444-0000-0000-0000-000000000002'::uuid), ('api:b', 'GET /b', '44444444-0000-0000-0000-000000000003'::uuid), ('api:c', 'GET /c', null)) v(k, n, i);

select pg_temp.como((select will_auth from fx));
set local role authenticated;
-- 1. só épicos e histórias (desenhos desligados)
select pg_temp.ok((fonte_opcoes('repo', '33333333-0000-0000-0000-000000000003', false, true) ->> 'desenhos') = 'false', 'desligar os desenhos sem desligar o repositório');
reset role;
select pg_temp.ok((select arquivado_em is not null from infra_diagramas where chave_auto = 'github:dono/repo:software') and exists (select 1 from infra_canvas where caminho like 'arquivo/auto%' and no_id = (select a1 from fx)),
  'desenhos desligados: o desenho vai para o arquivo e o quadro sai do canvas');
select pg_temp.ok(exists (select 1 from repositorios where id = '33333333-0000-0000-0000-000000000003'), 'o repositório continua ligado');
-- 2. liga os desenhos de novo
create temp table pedidos0 as select count(*) n from infra_automacoes;
set local role authenticated;
select fonte_opcoes('repo', '33333333-0000-0000-0000-000000000003', true, true);
reset role;
select pg_temp.ok((select arquivado_em is null from infra_diagramas where chave_auto = 'github:dono/repo:software') and exists (select 1 from infra_canvas where caminho like 'quadros/auto%' and no_id = (select a1 from fx))
  and (select count(*) from infra_automacoes) > (select n from pedidos0), 'desenhos ligados de novo: voltam do arquivo e o robô é chamado para atualizar');
-- 3. só desenhos (épicos e histórias desligados), mandando para a lixeira o que ninguém mexeu
set local role authenticated;
create temp table r3 as select fonte_opcoes('repo', '33333333-0000-0000-0000-000000000003', true, false, true) r;
reset role;
select pg_temp.ok((select excluido_em is not null from itens where id = '44444444-0000-0000-0000-000000000002'), 'a história intacta vai para a lixeira');
select pg_temp.ok((select excluido_em is null from itens where id = '44444444-0000-0000-0000-000000000003') and (select excluido_em is null from itens where id = '44444444-0000-0000-0000-000000000001'),
  'a história que alguém comentou fica, e o épico dela também');
select pg_temp.ok(not exists (select 1 from analise_inventario where origem = 'repo:33333333-0000-0000-0000-000000000003' and item_id is null), 'o que ainda não tinha virado item não vai ser montado');
select pg_temp.ok(analise_inventario_gravar((select a1 from fx), '33333333-0000-0000-0000-000000000003', null, 'dono/repo', '[{"tipo":"api","chave":"api:d","grupo":"G","nome":"GET /d","onde":"x"}]') = 0, 'com a chave desligada o robô não grava inventário novo');
-- 4. liga de novo: volta da lixeira o que foi por isso
set local role authenticated;
select pg_temp.ok((fonte_opcoes('repo', '33333333-0000-0000-0000-000000000003', true, true) ->> 'voltaram')::int = 1, 'épicos e histórias ligados de novo: a história volta da lixeira');
reset role;
select pg_temp.ok((select excluido_em is null from itens where id = '44444444-0000-0000-0000-000000000002'), 'e fica viva de novo');
-- 5. nenhum dos dois, sem lixeira: nada é apagado
set local role authenticated;
select fonte_opcoes('repo', '33333333-0000-0000-0000-000000000003', false, false, false);
reset role;
select pg_temp.ok((select not gera_desenhos and not gera_itens from repositorios where id = '33333333-0000-0000-0000-000000000003') and not exists (select 1 from itens where id::text like '44444444%' and excluido_em is not null),
  'nenhum dos dois: o repositório fica ligado (ficha e análise continuam) e sem a lixeira nada sai');
-- 6. pessoa de fora não muda
select gen_random_uuid() as fora \gset
insert into auth.users (id, email, raw_user_meta_data) values (:'fora', 'fora-' || :'fora' || '@t.com', '{"nome":"Fora"}');
select pg_temp.como(:'fora');
set local role authenticated;
do $$ begin perform fonte_opcoes('repo', '33333333-0000-0000-0000-000000000003', true, true); raise notice 'FALHA pessoa de fora mudou';
exception when insufficient_privilege then raise notice 'OK    pessoa de outro espaço não muda as chaves'; end $$;
reset role;
rollback;
