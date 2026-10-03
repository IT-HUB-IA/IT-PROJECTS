-- SOMENTE TESTE LOCAL: parte 64. Repositório ou banco que sai do ponto leva junto os desenhos, quadros e ficha feitos com ele ali.
\set ON_ERROR_STOP 1
\pset tuples_only on
begin;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;
-- a2: uma aplicação irmã, no mesmo produto da a1
insert into nos (tipo, nome, pai_id, espaco_id) select 'aplicacao', 'App irmã do teste', pai_id, espaco_id from nos where nome = 'Java BL' and tipo = 'aplicacao';
create temp table fx as select (select id from nos where nome = 'Java BL' and tipo = 'aplicacao') a1, (select id from nos where nome = 'App irmã do teste') a2,
  (select id from nos where tipo = 'aplicacao' and nome not in ('Java BL','Java Fiscal') and interno.infra_no_de(id) <> interno.infra_no_de((select id from nos where nome = 'Java BL' and tipo = 'aplicacao')) limit 1) a3;
-- o robô montou na a1 os desenhos de um repositório que estava lá
insert into repositorios (id, no_id, provedor, nome) select '11111111-0000-0000-0000-000000000001', a1, 'github', 'dono/errado' from fx;
insert into infra_diagramas (no_id, aba, nome, formato, origem, chave_auto) select a1, 'software', 'Software · dono/errado', 'plantuml', 'github', 'github:dono/errado:software' from fx;
insert into infra_diagramas (no_id, aba, nome, formato, origem, chave_auto) select a1, 'software', 'Software · dono/outro', 'plantuml', 'manual', null from fx;
select interno.infra_quadro_gravar((select a1 from fx), 'software', 'github:dono/errado:software', 'Software · dono/errado', '{"nodes":[{"id":"n1"}],"edges":[]}', (select id from infra_diagramas where chave_auto = 'github:dono/errado:software'), 'robô');
insert into ficha_auto (no_id, origem, repositorio_id, fonte, rotulo, secao, campo, valor) select a1, 'repo:11111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'codigo', 'dono/errado', 'Stack', 'Linguagens', 'TS' from fx;
select pg_temp.ok((select arquivado_em is null and quadro like 'quadros/auto%' from infra_diagramas where chave_auto = 'github:dono/errado:software'), 'antes: desenho e quadro do repositório na aplicação 1');
-- mover para outra aplicação do mesmo produto: a aplicação 1 deixa de ter os desenhos dele
update repositorios set no_id = (select a2 from fx) where id = '11111111-0000-0000-0000-000000000001';
select pg_temp.ok((select arquivado_em is not null from infra_diagramas where chave_auto = 'github:dono/errado:software' and no_id = (select a1 from fx)), 'mudou para outra aplicação do mesmo produto: o desenho da aplicação antiga vai para o arquivo');
select pg_temp.ok(not exists (select 1 from infra_canvas where no_id = (select a1 from fx) and caminho like 'quadros/auto%') and exists (select 1 from infra_canvas where no_id = (select a1 from fx) and caminho like 'arquivo/auto%'),
  'o quadro dele sai do canvas (vai para arquivo/, não é apagado)');
select pg_temp.ok(not exists (select 1 from infra_canvas c, jsonb_array_elements(c.dados -> 'nodes') n where c.no_id = (select a1 from fx) and c.caminho = 'quadros/raiz' and n ->> 'quadroId' like 'auto%'), 'e o card some do quadro principal');
select pg_temp.ok(not exists (select 1 from ficha_auto where repositorio_id = '11111111-0000-0000-0000-000000000001' and no_id = (select a1 from fx)), 'a ficha técnica feita por ele no ponto antigo sai');
select pg_temp.ok((select arquivado_em is null from infra_diagramas where nome = 'Software · dono/outro'), 'desenho feito à mão não é mexido');
-- desenho do produto continua: o repositório ainda está dentro dele
insert into infra_diagramas (no_id, aba, nome, formato, origem, chave_auto) select interno.infra_no_de(a1), 'software', 'Software do produto', 'plantuml', 'github', 'github:dono/errado:software' from fx;
select interno.infra_limpar_no(interno.infra_no_de((select a1 from fx)));
select pg_temp.ok((select arquivado_em is null from infra_diagramas where nome = 'Software do produto'), 'no produto o desenho fica (o repositório continua numa aplicação dele)');
-- saiu do produto: o desenho do produto também vai
update repositorios set no_id = (select a3 from fx) where id = '11111111-0000-0000-0000-000000000001';
select pg_temp.ok((select arquivado_em is not null from infra_diagramas where nome = 'Software do produto'), 'foi para outro produto: o desenho do produto antigo também vai para o arquivo');
-- banco removido
insert into infra_bancos (id, no_id, nome, provedor, motor, esquemas) select '22222222-0000-0000-0000-000000000002', a1, 'Banco x', 'aws', 'postgres', '{public}' from fx;
insert into infra_diagramas (no_id, aba, nome, formato, origem, chave_auto) select a1, 'der', 'DER · Banco x', 'dbml', 'banco', 'banco:22222222-0000-0000-0000-000000000002:der:public' from fx;
delete from infra_bancos where id = '22222222-0000-0000-0000-000000000002';
select pg_temp.ok((select arquivado_em is not null from infra_diagramas where nome = 'DER · Banco x'), 'banco removido: o desenho dele vai para o arquivo');
select pg_temp.ok((select count(*) from infra_diagramas where nome in ('Software · dono/errado', 'DER · Banco x', 'Software do produto')) = 3, 'nada foi apagado (só arquivado)');
rollback;
