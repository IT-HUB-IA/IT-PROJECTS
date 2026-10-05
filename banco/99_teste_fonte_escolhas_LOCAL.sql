-- SOMENTE TESTE LOCAL: parte 70 (cada coisa que o robô faz com uma fonte é uma escolha própria). Numa transação que volta atrás.
\set ON_ERROR_STOP 1
\pset tuples_only on
begin;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;
create or replace function pg_temp.como(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, true); perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true); end $$;
create temp table fx as select (select id from nos where nome = 'Java BL' and tipo = 'aplicacao') a1, (select auth_user_id from pessoas where nome = 'William') will_auth,
  (select auth_user_id from pessoas where nome = 'Ana (exemplo)') ana_auth;
grant select on fx to authenticated;
insert into git_conexoes (id, espaco_id, provedor, externo_id, conta) select '33333333-0000-0000-0000-000000000072', n.espaco_id, 'github', '999', 'dono' from fx join nos n on n.id = fx.a1;
insert into supa_conexoes (id, espaco_id, conta) select '33333333-0000-0000-0000-000000000073', n.espaco_id, 'dono' from fx join nos n on n.id = fx.a1;
insert into repositorios (id, no_id, provedor, nome, conexao_id) select '33333333-0000-0000-0000-000000000070', a1, 'github', 'dono/escolhas', '33333333-0000-0000-0000-000000000072' from fx;
insert into infra_bancos (id, no_id, nome, provedor, motor, esquemas, supa_conexao_id, supa_projeto) select '33333333-0000-0000-0000-000000000071', a1, 'Banco escolhas', 'supabase', 'postgres', '{public}', '33333333-0000-0000-0000-000000000073', 'abcdefghijklmnopqrst' from fx;

-- 1. quem liga agora começa com tudo ligado (nada muda para quem já usava)
select pg_temp.ok((select gera_ficha and gera_analise and gera_mapa and mover_status from repositorios where id = '33333333-0000-0000-0000-000000000070')
  and (select gera_ficha and gera_analise from infra_bancos where id = '33333333-0000-0000-0000-000000000071'), 'fonte nova começa com Ficha, Análise, Mapa e Mudar a situação ligados');
select pg_temp.ok((select count(*) from pg_proc where proname = 'fonte_opcoes') = 2, 'só uma fonte_opcoes (a porta e o corpo), sem versão repetida');

-- 2. desligar cada uma, sem mexer nas outras
select pg_temp.como((select will_auth from fx));
set local role authenticated;
create temp table r2 as select fonte_opcoes('repo', '33333333-0000-0000-0000-000000000070', null, null, false, false, null, null, null) r;
reset role;
select pg_temp.ok((select (r->>'ficha')::boolean = false and (r->>'analise')::boolean and (r->>'mapa')::boolean and (r->>'mover')::boolean and (r->>'desenhos')::boolean and (r->>'itens')::boolean from r2),
  'desligar só a Ficha técnica: as outras escolhas ficam como estavam');
set local role authenticated;
select fonte_opcoes('repo', '33333333-0000-0000-0000-000000000070', true, true, false, false, false, false, false);
reset role;
select pg_temp.ok((select not gera_ficha and not gera_analise and not gera_mapa and not mover_status and gera_desenhos and gera_itens from repositorios where id = '33333333-0000-0000-0000-000000000070'),
  'desligar Ficha, Análise, Mapa e Mudar a situação, deixando Desenhos e Épicos');
-- os parâmetros antigos (5) continuam valendo e não religam o que foi desligado
set local role authenticated;
select fonte_opcoes(p_tipo => 'repo', p_id => '33333333-0000-0000-0000-000000000070', p_desenhos => false, p_itens => true, p_lixeira => false);
reset role;
select pg_temp.ok((select not gera_desenhos and not gera_ficha and not gera_analise and not gera_mapa and not mover_status from repositorios where id = '33333333-0000-0000-0000-000000000070'),
  'chamar só com desenhos e épicos (como antes) não religa Ficha, Análise, Mapa nem Mudar a situação');

-- 3. o robô recebe as chaves no pedido
insert into infra_automacoes (no_id, origem) select a1, 'manual' from fx;
create temp table px as select p from jsonb_array_elements(infra_auto_proximos(5)) p;
select pg_temp.ok(exists (select 1 from px, jsonb_array_elements(px.p->'repositorios') r where r->>'id' = '33333333-0000-0000-0000-000000000070' and r->>'gera_ficha' = 'false' and r->>'gera_analise' = 'false')
  and exists (select 1 from px, jsonb_array_elements(px.p->'bancos') b where b->>'id' = '33333333-0000-0000-0000-000000000071' and b->>'gera_ficha' = 'true'),
  'o pedido ao robô leva as chaves de Ficha e Análise de cada repositório e banco');

-- 4. com a chave desligada, o banco também recusa gravar a ficha e a análise
select pg_temp.ok(infra_ficha_gravar((select a1 from fx), '33333333-0000-0000-0000-000000000070', null, 'dono/escolhas', 'abc', '[{"secao":"Stack","campo":"Linguagem","valor":"TypeScript"}]') = 0
  and not exists (select 1 from ficha_auto where origem = 'repo:33333333-0000-0000-0000-000000000070'), 'Ficha técnica desligada: nada é gravado');
select pg_temp.ok(analise_gravar((select a1 from fx), '33333333-0000-0000-0000-000000000070', null, 'dono/escolhas', 'abc', 3, '[{"impressao":"abcdef12","regra":"x","titulo":"t","gravidade":"alta"}]') is null
  and not exists (select 1 from analise_achados where origem = 'repo:33333333-0000-0000-0000-000000000070'), 'Análise desligada: nenhum alerta é gravado');
-- e com a chave ligada, grava normalmente (o banco continua com tudo ligado)
select pg_temp.ok(infra_ficha_gravar((select a1 from fx), null, '33333333-0000-0000-0000-000000000071', 'Banco escolhas', 'abc', '[{"secao":"Database","campo":"Motor","valor":"PostgreSQL"}]') >= 1,
  'Ficha técnica ligada: grava normalmente');

-- 5. Mapa do Sistema: a publicação só pede o mapa com a chave ligada
update repositorios set ativo = true where id = '33333333-0000-0000-0000-000000000070';
insert into infra_automacoes (no_id, origem, repositorio_id, referencia) select a1, 'github', '33333333-0000-0000-0000-000000000070', 'c1' from fx;
select pg_temp.ok(not exists (select 1 from mapa_analises where repositorio_id = '33333333-0000-0000-0000-000000000070'), 'Mapa do Sistema desligado: publicar não pede o mapa');
update repositorios set gera_mapa = true where id = '33333333-0000-0000-0000-000000000070';
insert into infra_automacoes (no_id, origem, repositorio_id, referencia) select a1, 'github', '33333333-0000-0000-0000-000000000070', 'c2' from fx;
select pg_temp.ok(exists (select 1 from mapa_analises where repositorio_id = '33333333-0000-0000-0000-000000000070' and referencia = 'c2'), 'Mapa do Sistema ligado: publicar pede o mapa');

-- 6. religar a Ficha chama o robô; banco não tem Mapa nem Mudar a situação
update infra_automacoes set status = 'pronto' where no_id = (select a1 from fx) and status in ('pendente', 'rodando');
create temp table p0 as select count(*) n from infra_automacoes;
select pg_temp.como((select will_auth from fx));
set local role authenticated;
create temp table r6 as select fonte_opcoes('banco', '33333333-0000-0000-0000-000000000071', null, null, false, false, false, true, true) r;
select fonte_opcoes('repo', '33333333-0000-0000-0000-000000000070', null, null, false, true, null, null, null);
reset role;
select pg_temp.ok((select (r->>'ficha')::boolean = false and (r->>'analise')::boolean = false and r->>'mapa' is null and r->>'mover' is null from r6), 'banco: Ficha e Análise mudam; Mapa e Mudar a situação não existem para banco');
select pg_temp.ok((select count(*) from infra_automacoes) > (select n from p0), 'religar a Ficha técnica chama o robô para atualizar');

-- 7. quem não é do espaço não muda nada
select pg_temp.como('99999999-0000-0000-0000-000000000099');
set local role authenticated;
create temp table r7 (msg text);
do $$ begin perform fonte_opcoes('repo', '33333333-0000-0000-0000-000000000070', null, null, false, false); insert into r7 values ('mudou');
exception when others then insert into r7 values (sqlerrm); end $$;
reset role;
select pg_temp.ok((select msg from r7) <> 'mudou' and (select gera_ficha from repositorios where id = '33333333-0000-0000-0000-000000000070'), 'quem não é do espaço não muda as escolhas (' || (select msg from r7) || ')');
rollback;
