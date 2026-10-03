-- SOMENTE TESTE LOCAL: parte 59 (S3, S6, S7). Roda depois de todas as partes e dos usuários de teste (91). Numa transação que volta atrás.
\set ON_ERROR_STOP 1
\pset tuples_only on
begin;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;
-- tenta um comando como um papel, dentro de um ponto de volta; OK se for recusado
create or replace function pg_temp.recusa(p_papel text, p_sql text, p_nome text) returns text language plpgsql as $$
begin
  begin
    if p_papel <> 'dono' then execute format('set local role %I', p_papel); end if;
    execute p_sql;
    reset role;
    return 'FALHA ' || p_nome || ' (passou)';
  exception when insufficient_privilege then reset role; return 'OK    ' || p_nome || ' é recusado';
            when others then reset role; return 'FALHA ' || p_nome || ' (erro ' || sqlstate || ': ' || sqlerrm || ')';
  end;
end $$;
create temp table fx as select (select id from itens i where not exists (select 1 from itens c where c.pai_id = i.id) order by chave limit 1) item, (select id from pessoas where nome = 'William') will,
  (select auth_user_id from pessoas where nome = 'William') will_auth;
grant select on fx to authenticated, service_role;
-- histórico com uma linha de cada para tentar mudar
insert into public.itens_historico (item_id, tipo, de, para, texto, pessoa_id) select item, 'situacao', 'todo', 'doing', 'teste', will from fx;
insert into public.itens_descricao_versoes (item_id, texto, autor_id) select item, 'versão de teste', will from fx;
insert into auditoria.registros (tabela, registro_id, acao, mudancas) select 'itens', item, 'U', '{"teste":1}' from fx;

-- 1. UPDATE, DELETE e TRUNCATE recusados para todo papel (quem está logado, service_role e até o dono do banco)
create temp table r (linha text);
insert into r select pg_temp.recusa(papel, cmd || ' ' || tab || case when cmd = 'truncate' then '' when cmd = 'update' then ' set criado_em = criado_em' else '' end,
                                    cmd || ' em ' || tab || ' por ' || papel)
  from unnest(array['authenticated','service_role','dono']) papel,
       unnest(array['public.itens_historico','public.itens_descricao_versoes']) tab,
       unnest(array['update','delete from','truncate']) cmd;
insert into r select pg_temp.recusa(papel, x, split_part(x, ' ', 1) || ' em auditoria.registros por ' || papel)
  from unnest(array['service_role','dono']) papel,
       unnest(array['update auditoria.registros set em = em', 'delete from auditoria.registros', 'truncate auditoria.registros']) x;
insert into r select pg_temp.recusa('authenticated', 'select 1 from auditoria.registros', 'quem está logado nem enxerga auditoria.registros');
select linha from r order by linha;
select pg_temp.ok((select count(*) from r) = 25, '25 tentativas (3 papéis x 2 tabelas x 3 comandos + auditoria)');
select pg_temp.ok(not exists (select 1 from information_schema.role_table_grants where grantee in ('anon','authenticated','service_role','PUBLIC')
  and privilege_type in ('UPDATE','DELETE','TRUNCATE') and (table_schema, table_name) in (('auditoria','registros'),('public','itens_historico'),('public','itens_descricao_versoes'))),
  'nenhum papel comum tem UPDATE, DELETE ou TRUNCATE nas três');
select pg_temp.ok(not exists (select 1 from information_schema.role_table_grants where grantee in ('anon','authenticated','PUBLIC') and privilege_type = 'INSERT'
  and (table_schema, table_name) in (('auditoria','registros'),('public','itens_historico'),('public','itens_descricao_versoes'))), 'só o próprio banco insere (quem está logado não tem INSERT)');

-- 2. a gravação continua: mudar a situação grava histórico; mexer na descrição seguido junta numa versão; a auditoria registra
select set_config('request.jwt.claim.sub', (select will_auth::text from fx), true);
select set_config('request.jwt.claims', json_build_object('sub', (select will_auth from fx), 'role', 'authenticated')::text, true);
create temp table antes as select (select count(*) from itens_historico where item_id = (select item from fx)) h,
  (select count(*) from itens_descricao_versoes where item_id = (select item from fx)) v, (select count(*) from auditoria.registros) a,
  (select f.id from status_fluxo f, itens i where i.id = (select item from fx) and f.id <> i.status_id and interno.po_grupo(f.id) in ('todo','doing')
     and interno.po_grupo(f.id) <> interno.po_grupo(i.status_id) limit 1) novo_status;
grant select on antes to authenticated;
set local role authenticated;
update itens set status_id = (select novo_status from antes) where id = (select item from fx);
update itens set descricao = 'primeira' where id = (select item from fx);
update itens set descricao = 'segunda, logo depois' where id = (select item from fx);
reset role;
select pg_temp.ok((select count(*) from itens_historico where item_id = (select item from fx)) > (select h from antes), 'mudar a situação grava no histórico');
select pg_temp.ok((select count(*) from itens_descricao_versoes where item_id = (select item from fx)) = (select v from antes)
  and (select texto from itens_descricao_versoes where item_id = (select item from fx) order by criado_em desc limit 1) = 'segunda, logo depois',
  'mexer seguido na descrição (mesma pessoa, até 10 minutos) fica na versão aberta: a própria gravação consegue atualizar');
select pg_temp.ok((select count(*) from auditoria.registros) > (select a from antes), 'a auditoria continua gravando');
-- a versão já fechada (mais de 10 minutos) não muda nem pela gravação
insert into public.itens_descricao_versoes (item_id, texto, autor_id, criado_em) select item, 'versão antiga', will, now() - interval '1 hour' from fx;
insert into r select pg_temp.recusa('dono', $q$select set_config('ciclodev.juntando_versao', 'sim', true); update public.itens_descricao_versoes set texto = 'x' where texto = 'versão antiga'$q$, 'mudar versão fechada (mais de 10 minutos), mesmo avisando que é a gravação,');

-- 3. as exceções automáticas: apagar o item de vez leva o histórico; apagar a pessoa só esvazia a autoria
insert into public.pessoas (id, nome) values ('33333333-3333-3333-3333-333333333333', 'Pessoa Temporária');
insert into public.itens_historico (item_id, tipo, para, texto, pessoa_id) select item, 'situacao', 'done', 'da pessoa temporária', '33333333-3333-3333-3333-333333333333' from fx;
delete from public.pessoas where id = '33333333-3333-3333-3333-333333333333';
select pg_temp.ok((select pessoa_id is null from itens_historico where texto = 'da pessoa temporária'), 'apagar a pessoa deixa a autoria vazia e a linha fica');
delete from public.itens where id = (select item from fx);
select pg_temp.ok(not exists (select 1 from itens_historico where item_id = (select item from fx)) and not exists (select 1 from itens_descricao_versoes where item_id = (select item from fx)),
  'apagar o item de vez (lixeira) leva o histórico dele junto');
select linha from r where linha like '%versão fechada%';

-- 4. S6: nenhuma função nem política com nome de pessoa
select pg_temp.ok(not exists (select 1 from pg_proc p, pessoas x where p.proname ilike '%' || lower(split_part(x.nome, ' ', 1)) || '%' and length(split_part(x.nome, ' ', 1)) > 3)
  and not exists (select 1 from pg_policy p, pessoas x where p.polname ilike '%' || lower(split_part(x.nome, ' ', 1)) || '%' and length(split_part(x.nome, ' ', 1)) > 3),
  'nenhuma função ou política com nome de pessoa');
-- 5. S7: nada do public, interno e logica executável por anon; search_path fixo em toda função desses esquemas
select pg_temp.ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','interno','logica') and has_function_privilege('anon', p.oid, 'EXECUTE')),
  'nenhuma função do public, interno ou logica executável por anon');
select pg_temp.ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('interno','logica') and p.prokind = 'f'
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search\_path=%')), 'toda função do interno e logica tem search_path fixo');
rollback;
