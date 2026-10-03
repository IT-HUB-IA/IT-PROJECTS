-- SOMENTE TESTE LOCAL: parte 66 (épico do robô cuja situação mudou sozinha continua "intocado"). Numa transação que volta atrás.
\set ON_ERROR_STOP 1
\pset tuples_only on
begin;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;
create temp table fx as select (select id from nos where nome = 'Java BL' and tipo = 'aplicacao') a1,
  (select id from nos where pai_id = (select id from nos where nome = 'Java BL' and tipo = 'aplicacao') and tipo = 'frente' limit 1) fr, (select status_id from itens where status_id is not null limit 1) st;
-- dois épicos do robô, cada um com uma história do inventário
insert into itens (id, frente_id, titulo, tipo, status_id, descricao) select ('55555555-0000-0000-0000-00000000000' || n)::uuid, fr, 'Épico ' || n, 'epic', st, 'Épico montado pelo CicloDev a partir do banco' from fx, generate_series(1, 2) n;
insert into itens (id, frente_id, titulo, tipo, status_id, pai_id) select ('55555555-0000-0000-0000-00000000001' || n)::uuid, fr, 'Tabela ' || n, 'story', st, ('55555555-0000-0000-0000-00000000000' || n)::uuid from fx, generate_series(1, 2) n;
insert into analise_inventario (no_id, origem, rotulo, tipo, chave, grupo, nome, onde, sinais, item_id)
  select a1, 'banco:66666666-0000-0000-0000-000000000066', 'banco', 'tabela', 't' || n, 'Épico ' || n, 'Tabela ' || n, 'x', '{}', ('55555555-0000-0000-0000-00000000001' || n)::uuid from fx, generate_series(1, 2) n;
-- épico 1: só a situação mudou (acompanhou a história), com o nome de quem mexeu na história
insert into auditoria.registros (tabela, registro_id, acao, mudancas, em) values
  ('itens', '55555555-0000-0000-0000-000000000001', 'U', '{"status_id":[null, "x"], "iniciado_em":[null, "2026-10-03"]}', now() + interval '12 minutes');
-- épico 2: alguém trocou o título
insert into auditoria.registros (tabela, registro_id, acao, mudancas, em) values
  ('itens', '55555555-0000-0000-0000-000000000002', 'U', '{"titulo":["Épico 2", "Meu épico"], "status_id":[null, "x"]}', now() + interval '12 minutes');
create temp table r as select id from interno.itens_da_fonte_intactos((select a1 from fx), 'banco:66666666-0000-0000-0000-000000000066') id;
select pg_temp.ok((select count(*) from r where id in ('55555555-0000-0000-0000-000000000011', '55555555-0000-0000-0000-000000000012')) = 2, 'as duas histórias que ninguém mexeu contam como intocadas');
select pg_temp.ok(exists (select 1 from r where id = '55555555-0000-0000-0000-000000000001'), 'épico cuja situação só acompanhou a história conta como intocado (vai para a lixeira junto)');
select pg_temp.ok(not exists (select 1 from r where id = '55555555-0000-0000-0000-000000000002'), 'épico com título trocado por alguém continua fora (não vai para a lixeira)');
rollback;
