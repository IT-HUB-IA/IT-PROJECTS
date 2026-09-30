-- SOMENTE TESTE LOCAL: parte 29 (Infraestrutura). Roda depois das partes 00 a 20, 22, 23, 25, 26, 28, 29 e dos usuários de teste (91).
\set ON_ERROR_STOP 1
\pset tuples_only on
create or replace function pg_temp.como(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, false); perform set_config('request.jwt.claims', json_build_object('sub', p)::text, false); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;
create temp table t as select
  (select id from nos where tipo = 'projeto' order by criado_em limit 1) as pj,
  (select id from nos where tipo = 'produto' order by criado_em limit 1) as pr,
  (select id from nos where tipo = 'cliente' order by criado_em limit 1) as cli,
  null::uuid as d;
grant all on t to authenticated;

-- ---------- William cria e muda desenhos ----------
select pg_temp.como('00000000-0000-0000-0000-00000000000a'); set role authenticated;
with x as (insert into infra_diagramas (no_id, aba, nome, formato, fonte) select pj, 'solucao', 'Contexto do sistema', 'structurizr', 'workspace { }' from t returning id)
update t set d = (select id from x);
select pg_temp.ok((select d from t) is not null, 'William cria um desenho no projeto');
insert into infra_diagramas (no_id, aba, nome, formato, fonte) select pr, 'der', 'Banco', 'dbml', 'Table itens { id uuid [pk] }' from t;
select pg_temp.ok((select count(*) from infra_diagramas) = 2, 'e outro no produto');
do $$ begin insert into infra_diagramas (no_id, aba, nome, formato) select cli, 'der', 'x', 'dbml' from t; raise exception 'aceitou'; exception when others then if sqlerrm = 'aceitou' then raise; end if; end $$;
select pg_temp.ok(true, 'cliente não tem aba Infraestrutura');
do $$ begin insert into infra_diagramas (no_id, aba, nome, formato) select pj, 'qualquer', 'x', 'dbml' from t; raise exception 'aceitou'; exception when others then if sqlerrm = 'aceitou' then raise; end if; end $$;
select pg_temp.ok(true, 'só as 10 sub-abas existem');
update infra_diagramas set svg = '<svg/>', renderizado_em = now() where id = (select d from t);
update infra_diagramas set fonte = 'workspace { model { u = person "Usuário" } }' where id = (select d from t);
select pg_temp.ok((select versao from infra_diagramas where id = (select d from t)) = 2, 'mudar o texto sobe a versão');
select pg_temp.ok((select svg is null from infra_diagramas where id = (select d from t)), 'a imagem antiga deixa de valer até gerar de novo');
select pg_temp.ok((select fonte || '/' || svg from infra_diagramas_versoes where diagrama_id = (select d from t) and versao = 1) = 'workspace { }/<svg/>', 'a versão anterior fica guardada com a imagem dela');
do $$ begin delete from infra_diagramas; raise exception 'apagou'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'ninguém apaga desenho pela tela (só arquiva)');
do $$ begin delete from infra_diagramas_versoes; raise exception 'apagou'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'ninguém apaga versão');
update infra_diagramas set arquivado_em = now() where no_id = (select pr from t);
select pg_temp.ok((select count(*) from infra_diagramas where arquivado_em is not null) = 1, 'arquivar funciona');
insert into infra_canvas (no_id, aba, caminho, dados) select pj, 'solucao', 'quadros/raiz', '{"nome":"Quadro principal","nodes":[],"edges":[]}' from t;
insert into infra_canvas (no_id, aba, caminho, dados) select pj, 'solucao', 'quadros/raiz', '{"nome":"Quadro principal","nodes":[{"id":"n1"}],"edges":[]}' from t
  on conflict (no_id, aba, caminho) do update set dados = excluded.dados;
select pg_temp.ok((select jsonb_array_length(dados -> 'nodes') from infra_canvas) = 1, 'o canvas grava e atualiza os documentos');
do $$ begin insert into infra_canvas (no_id, aba, caminho) select pj, 'solucao', '../fora' from t; raise exception 'aceitou'; exception when others then if sqlerrm = 'aceitou' then raise; end if; end $$;
select pg_temp.ok(true, 'caminho de documento inválido é recusado');
insert into infra_geracoes (no_id, aba) select pj, 'der' from t;
select pg_temp.ok((select count(*) from infra_geracoes where pedido_por is not null) = 1, 'o pedido ao DevIT fica guardado com quem pediu');
do $$ begin update infra_geracoes set status = 'pronto'; raise exception 'mudou'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'o resultado do pedido só a função muda');
reset role;

-- ---------- alguém de fora não vê nada ----------
insert into pessoas (auth_user_id, nome, email, papel, ativo) values ('00000000-0000-0000-0000-0000000000ff', 'Pessoa de fora', 'fora@teste', 'dev', true);
select pg_temp.como('00000000-0000-0000-0000-0000000000ff'); set role authenticated;
select pg_temp.ok((select count(*) from infra_diagramas) = 0 and (select count(*) from infra_canvas) = 0 and (select count(*) from infra_diagramas_versoes) = 0 and (select count(*) from infra_geracoes) = 0, 'quem não enxerga o projeto não vê desenho, canvas, versão nem pedido');
do $$ begin insert into infra_diagramas (no_id, aba, nome, formato) select pj, 'der', 'x', 'dbml' from t; raise exception 'aceitou'; exception when others then if sqlerrm = 'aceitou' then raise; end if; end $$;
select pg_temp.ok(true, 'e não cria desenho no projeto dos outros');
update infra_canvas set dados = '{}';
reset role;
select pg_temp.ok((select jsonb_array_length(dados -> 'nodes') from infra_canvas) = 1, 'e não mexe no canvas dos outros');

-- ---------- o stakeholder do projeto vê, mas não mexe ----------
select pg_temp.como('00000000-0000-0000-0000-00000000000c'); set role authenticated;
select pg_temp.ok((select count(*) from infra_diagramas where no_id = (select pj from t)) = 1, 'o stakeholder do projeto vê o desenho do projeto');
do $$ begin insert into infra_diagramas (no_id, aba, nome, formato) select pj, 'der', 'x', 'dbml' from t; raise exception 'aceitou'; exception when others then if sqlerrm = 'aceitou' then raise; end if; end $$;
select pg_temp.ok(true, 'mas não cria desenho');
update infra_diagramas set fonte = 'mudou' where no_id = (select pj from t);
reset role;
select pg_temp.ok((select versao from infra_diagramas where id = (select d from t)) = 2, 'e não muda desenho');

-- ---------- dev do projeto (Bruno) trabalha junto ----------
select pg_temp.como('00000000-0000-0000-0000-00000000000d'); set role authenticated;
update infra_diagramas set fonte = 'workspace { model { u = person "Usuário" s = softwareSystem "CicloDev" } }' where id = (select d from t);
reset role;
select pg_temp.ok((select versao from infra_diagramas where id = (select d from t)) = 3, 'o dev do projeto também edita, e a versão sobe');
select 'FIM DO TESTE DA INFRAESTRUTURA';
